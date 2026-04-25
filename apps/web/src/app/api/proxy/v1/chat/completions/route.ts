// THE proxy. Verifies, charges on-chain, forwards to OpenRouter.

import { NextRequest } from "next/server";
import { verifyRequest, ProxyVerificationError, rollbackCap } from "@/lib/verify";
import { chargeOnChain, ensureUsdcApproval, ChargeError } from "@/lib/charge";
import { errorMap } from "@/lib/error-response";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { SignedDelegation } from "@/lib/eip712";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // Per-IP rate limit (defense vs DoS; signed-MAP path is also nonce-bound)
  const rl = await rateLimit(`proxy:${clientIp(req)}`, { limit: 120, windowSec: 60 });
  if (rl) return rl;

  const rawBody = await req.text();
  const headerParse = parseHeaders(req);
  if (headerParse.kind === "missing") return errorMap("MISSING_HEADERS", 400);
  if (headerParse.kind === "malformed") return errorMap("INVALID_DELEGATION", 400, headerParse.detail);
  const headers = headerParse.value;

  // NFT id parse — fail fast & cleanly on garbage input (Audit Security #11).
  const nftIdHeader = req.headers.get("x-map-nft-id");
  if (!nftIdHeader) return errorMap("MISSING_NFT_ID", 400);
  let nftId: bigint;
  try {
    if (!/^\d+$/.test(nftIdHeader)) throw new Error("nftId must be a non-negative integer");
    nftId = BigInt(nftIdHeader);
  } catch (e) {
    return errorMap("INVALID_NFT_ID", 400, e);
  }

  let verified;
  try {
    verified = await verifyRequest(headers, rawBody);
  } catch (e) {
    if (e instanceof ProxyVerificationError) return errorMap(e.code, 401, e.message);
    return errorMap("VERIFY_FAILED", 500, e);
  }

  // One-time approval for the demo (no-op once allowance is high)
  await ensureUsdcApproval().catch((e) => console.error("ensureUsdcApproval:", e));

  // On-chain charge — the request nonce doubles as the on-chain trace id.
  let chargeTx: { txHash: `0x${string}`; blockNumber: bigint };
  try {
    chargeTx = await chargeOnChain(nftId, headers.nonce);
  } catch (e) {
    // Only refund the cap counter when we KNOW the on-chain debit didn't land.
    // For UNCONFIRMED (TX may still land), keep the cap charged — over-conservative
    // is the right side to err on; the operator gets a clear log line + tx hash.
    if (e instanceof ChargeError && e.code === "REJECTED") {
      await rollbackCap(verified.sessionAddr);
      return errorMap("CHARGE_REJECTED", 502, e);
    }
    if (e instanceof ChargeError && e.code === "UNCONFIRMED") {
      console.error(`[proxy] CHARGE_UNCONFIRMED tx=${e.txHash} session=${verified.sessionAddr} — cap NOT rolled back`);
      return errorMap("CHARGE_UNCONFIRMED", 502, e);
    }
    // Unknown error — be safe, don't roll back (cap loss is preferred over double-spend).
    return errorMap("CHARGE_FAILED", 502, e);
  }

  // Decrypt user's OpenRouter key (for the hackathon, single shared key from env;
  // production decrypts a per-user KMS-wrapped key keyed by verified.userAddr)
  const upstreamKey = process.env.OPENROUTER_API_KEY;
  if (!upstreamKey) return errorMap("MISSING_UPSTREAM_KEY", 500);

  // Forward
  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstreamKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_DASHBOARD_BASE_URL ?? "https://moleculeprotocol.io",
        "X-Title": "Molecule Agent Proxy",
      },
      body: rawBody,
    });
  } catch (e) {
    return errorMap("UPSTREAM_UNREACHABLE", 502, e);
  }

  // Buffer (avoids "terminated" errors when proxied through multiple Node fetch hops).
  const upstreamText = await upstream.text();

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstream.headers.get("content-type") ?? "application/json");
  responseHeaders.set("X-MAP-Charge-Tx", chargeTx.txHash);
  responseHeaders.set("X-MAP-Charge-Block", chargeTx.blockNumber.toString());
  responseHeaders.set("X-MAP-User", verified.userAddr);

  return new Response(upstreamText, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type HeaderParse =
  | { kind: "ok"; value: ProxyHeadersValue }
  | { kind: "missing" }
  | { kind: "malformed"; detail: string };

interface ProxyHeadersValue {
  delegation: SignedDelegation;
  sessionSig: `0x${string}`;
  nonce: `0x${string}`;
  timestamp: number;
}

function parseHeaders(req: NextRequest): HeaderParse {
  const delegationB64 = req.headers.get("x-map-delegation");
  const sessionSig = req.headers.get("x-map-session-sig");
  const nonce = req.headers.get("x-map-nonce");
  const timestamp = req.headers.get("x-map-timestamp");
  if (!delegationB64 || !sessionSig || !nonce || !timestamp) return { kind: "missing" };
  try {
    const json = Buffer.from(delegationB64, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    const delegation: SignedDelegation = {
      message: {
        sessionKey: parsed.message.sessionKey,
        vault: parsed.message.vault,
        scope: parsed.message.scope,
        capPerDayUSDC: BigInt(parsed.message.capPerDayUSDC),
        expiresAt: BigInt(parsed.message.expiresAt),
        nonce: BigInt(parsed.message.nonce),
      },
      signature: parsed.signature,
    };
    return {
      kind: "ok",
      value: {
        delegation,
        sessionSig: sessionSig as `0x${string}`,
        nonce: nonce as `0x${string}`,
        timestamp: Number(timestamp),
      },
    };
  } catch (e) {
    return { kind: "malformed", detail: (e as Error).message };
  }
}
