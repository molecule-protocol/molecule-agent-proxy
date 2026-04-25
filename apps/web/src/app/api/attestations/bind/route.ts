// Bind an attestation to an agent's NFT on the Arc ValidationRegistry.
//
// Calls the issuer claim builder DIRECTLY (no HTTP self-call) — same code path
// as /api/issuers/{kyc,company} but without the latency or fragility of a
// localhost loopback fetch.
//
// SECURITY: this route spends gas from the relayer wallet. It MUST be gated
// (Bearer or IP allowlist) — without it, anyone on the public URL can drain
// the relayer wallet of $20 USDC at ~$0.01 per call (~2000 attempts).

import { NextRequest } from "next/server";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import { publicClient, relayerWallet } from "@/lib/viem";
import { ADDR, ABI } from "@/lib/contracts";
import { ISSUER_BUILDERS, ADDRESS_REGEX, type IssuerType } from "@/lib/issuers";
import { requireBearer } from "@/lib/auth-bearer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorMap } from "@/lib/error-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BindBody {
  nftId?: string;
  issuerType?: IssuerType;
  subject?: string;
}

export async function POST(req: NextRequest) {
  // Bearer gate — separate secret from openai-compat. The bind route spends
  // gas from the relayer wallet, so it gets its own narrowly-distributed token.
  // (Round-2 audit #3: previously shared OPENAI_COMPAT_BEARER, which leaked
  // openai-compat access also unlocked relayer-wallet draining.)
  const auth = requireBearer(req, "BIND_BEARER");
  if (auth) return auth;

  // Light IP rate limit on top — even with a stolen Bearer, can't drain the wallet
  const rl = await rateLimit(`bind:${clientIp(req)}`, { limit: 30, windowSec: 60 });
  if (rl) return rl;

  let body: BindBody;
  try {
    body = await req.json();
  } catch {
    return errorMap("INVALID_JSON", 400);
  }

  const { nftId, issuerType, subject } = body;
  if (!nftId || !issuerType || !subject) {
    return errorMap("MISSING_FIELDS", 400, "expected nftId, issuerType, subject");
  }
  if (!(issuerType in ISSUER_BUILDERS)) {
    return errorMap("UNKNOWN_ISSUER_TYPE", 400, `got ${issuerType}`);
  }
  if (!ADDRESS_REGEX.test(subject)) {
    return errorMap("INVALID_SUBJECT", 400, "subject must be 0x... 40-hex-char address");
  }
  if (!/^\d+$/.test(nftId)) {
    return errorMap("INVALID_NFT_ID", 400, "nftId must be a non-negative integer string");
  }

  // Build the issuer doc directly — no self-HTTP call (Audit Code #20)
  const issuerDoc = ISSUER_BUILDERS[issuerType](subject as `0x${string}`);

  // attestationHash = keccak256(issuerDID || JSON(claim) || subject)
  const attestationHash = keccak256(
    toBytes(`${issuerDoc.issuer.did}|${JSON.stringify(issuerDoc.claim)}|${subject}`),
  );

  // Submit on-chain
  const wallet = relayerWallet();
  const data = encodeFunctionData({
    abi: ABI.ValidationRegistry,
    functionName: "record",
    args: [BigInt(nftId), attestationHash],
  });
  let txHash: `0x${string}`;
  try {
    txHash = await wallet.sendTransaction({
      to: ADDR.validationRegistry,
      data,
      account: wallet.account!,
      chain: wallet.chain!,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
  } catch (e) {
    return errorMap("BIND_FAILED", 502, e);
  }

  return Response.json({
    ok: true,
    nftId,
    issuerType,
    subject,
    attestationHash,
    txHash,
    issuer: issuerDoc.issuer,
    claim: issuerDoc.claim,
    note: "Reclaim ZK proof verification is bypassed in this hackathon build; the on-chain binding is real and matches what would land in production.",
  });
}
