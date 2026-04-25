// Full request verification for the proxy. All checks must pass.
//
// Order is intentional: cheap checks first, then on-chain reads, finally cap
// counter increment. The cap counter is bumped LAST so a rejected request
// never consumes the legit user's daily budget. (Was a real bug pre-audit.)

import {
  recoverTypedDataAddress,
  recoverMessageAddress,
  keccak256,
  toBytes,
  isAddressEqual,
} from "viem";
import { publicClient } from "./viem";
import { ADDR, ABI } from "./contracts";
import { matchScope } from "./scope";
import { kv } from "./kv";
import {
  DELEGATION_TYPES,
  PRIMARY_TYPE,
  delegationDomain,
  type SignedDelegation,
  type DelegationMessage,
} from "./eip712";

export interface ProxyHeaders {
  delegation: SignedDelegation;
  sessionSig: `0x${string}`;
  nonce: `0x${string}`;
  timestamp: number;
}

export class ProxyVerificationError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

export interface VerifiedRequest {
  userAddr: `0x${string}`;
  sessionAddr: `0x${string}`;
  delegation: DelegationMessage;
  upstreamModel: string;
  upstreamProvider: string;
}

const NONCE_TTL_SEC = 600;
const SPEND_TTL_SEC = 24 * 60 * 60;
const PER_CALL_FEE = 500; // matches MoleculeVault.perCallFee on-chain

/** Default upstream provider tag for scope matching. The proxy currently only
 *  forwards to OpenRouter, so all scope checks resolve against "openrouter:*".
 *  Direct-OpenAI and direct-Anthropic routing is a v0.2 feature; if/when added,
 *  thread the actual upstream provider through to here.
 */
const UPSTREAM_PROVIDER = "openrouter";

export async function verifyRequest(
  headers: ProxyHeaders,
  rawBody: string,
): Promise<VerifiedRequest> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Freshness — cheapest check, reject before any KV/RPC work
  if (Math.abs(now - headers.timestamp) > 60) {
    throw new ProxyVerificationError("STALE", `timestamp drift > 60s`);
  }

  // 2. Replay protection — burns nonce slot regardless of downstream success.
  // (Burning before further checks is intentional: even an attacker who poisons
  // a single nonce can't flood, since each attempt costs them a unique nonce.)
  const nonceFresh = await kv().setNX(`nonce:${headers.nonce}`, "1", NONCE_TTL_SEC);
  if (!nonceFresh) throw new ProxyVerificationError("NONCE_REUSED");

  // 3. Recover signers — pure crypto, no I/O
  const userAddr = await recoverTypedDataAddress({
    domain: delegationDomain(),
    types: DELEGATION_TYPES,
    primaryType: PRIMARY_TYPE,
    message: headers.delegation.message,
    signature: headers.delegation.signature,
  });

  const requestDigest = keccak256(toBytes(`${rawBody}|${headers.nonce}|${headers.timestamp}`));
  const sessionAddr = await recoverMessageAddress({
    message: { raw: requestDigest },
    signature: headers.sessionSig,
  });

  // 4. Delegation health (no I/O)
  const m = headers.delegation.message;
  if (!isAddressEqual(m.vault, ADDR.moleculeVault)) {
    throw new ProxyVerificationError("WRONG_VAULT");
  }
  if (Number(m.expiresAt) < now) throw new ProxyVerificationError("EXPIRED");
  if (!isAddressEqual(sessionAddr, m.sessionKey)) {
    throw new ProxyVerificationError("SESSION_MISMATCH");
  }

  // 5. Body + scope
  let body: { model?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ProxyVerificationError("BAD_BODY");
  }
  if (!body.model || typeof body.model !== "string") {
    throw new ProxyVerificationError("NO_MODEL");
  }
  if (!matchScope(UPSTREAM_PROVIDER, body.model, m.scope)) {
    throw new ProxyVerificationError("OUT_OF_SCOPE", `model=${body.model}, scope=${m.scope.join(",")}`);
  }

  // 6. Revocation check (on-chain) — moved BEFORE cap bump so revoked keys
  //    can't burn the legit user's daily cap (Audit Security #2 / Code #3+#4).
  const revokedAt = (await publicClient.readContract({
    address: ADDR.revocationRegistry,
    abi: ABI.RevocationRegistry,
    functionName: "getRevokedAt",
    args: [sessionAddr],
  })) as bigint;
  if (revokedAt > 0n) throw new ProxyVerificationError("REVOKED");

  // 7. Cap check — atomic increment, then enforce. Rolled back on failure.
  const today = new Date().toISOString().slice(0, 10);
  const capKey = `spend:${sessionAddr}:${today}`;
  const totalAfter = await kv().incrby(capKey, PER_CALL_FEE, SPEND_TTL_SEC);
  if (totalAfter > Number(m.capPerDayUSDC)) {
    // Roll back the increment so a one-shot cap-hitting request doesn't burn
    // future budget (which would be unrecoverable until UTC midnight).
    await kv().incrby(capKey, -PER_CALL_FEE, SPEND_TTL_SEC).catch(() => {});
    throw new ProxyVerificationError("CAP_EXCEEDED", `${totalAfter} > ${m.capPerDayUSDC}`);
  }

  return {
    userAddr,
    sessionAddr,
    delegation: m,
    upstreamModel: body.model,
    upstreamProvider: UPSTREAM_PROVIDER,
  };
}

/** Roll back a previously-credited cap charge (e.g. when chargeOnChain fails after verify). */
export async function rollbackCap(sessionAddr: `0x${string}`): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await kv().incrby(`spend:${sessionAddr}:${today}`, -PER_CALL_FEE, SPEND_TTL_SEC).catch(() => {});
}
