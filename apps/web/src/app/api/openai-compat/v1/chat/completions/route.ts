// OpenAI-compatible passthrough endpoint.
//
// Lets any OpenAI-SDK-style client (incl. OpenClaw, LangChain, custom agents)
// use MAP without holding MAP-specific credentials in their env. The server
// loads pre-configured MAP credentials and signs every forwarded request.
//
// SECURITY: this endpoint is gated by a Bearer token (env OPENAI_COMPAT_BEARER).
// The Bearer is shared between this server and one trusted client (currently the
// OpenClaw container). Without it, anyone on the public URL could drain the
// demo user's daily cap and the server's OpenRouter key.

import { NextRequest } from "next/server";
import { setupMapClient, type MapCredentials, type SignedDelegation } from "@molecule/map-skill";
import { requireBearer } from "@/lib/auth-bearer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorOpenAI } from "@/lib/error-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _creds: MapCredentials | null = null;

function getCreds(): MapCredentials {
  if (_creds) return _creds;

  // Production path: per-user vault keyed by Bearer.
  // Hackathon path: single demo user from env vars (so Vercel + edge runtimes
  // don't need filesystem access; see Audit Code #1 + #18).
  const nftId = process.env.MAP_DEMO_NFT_ID;
  const sessionPrivateKey = process.env.MAP_DEMO_SESSION_KEY as `0x${string}` | undefined;
  const delegationJson = process.env.MAP_DEMO_DELEGATION;
  if (!nftId || !sessionPrivateKey || !delegationJson) {
    throw new Error("MAP_DEMO_NFT_ID, MAP_DEMO_SESSION_KEY, MAP_DEMO_DELEGATION must all be set");
  }
  const parsed = JSON.parse(delegationJson);
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
  _creds = {
    nftId: BigInt(nftId),
    sessionPrivateKey,
    delegation,
    proxyUrl: process.env.NEXT_PUBLIC_PROXY_BASE_URL ?? "http://localhost:3010",
  };
  return _creds;
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = requireBearer(req, "OPENAI_COMPAT_BEARER");
  if (auth) return auth;

  const rl = await rateLimit(`openai-compat:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (rl) return rl;

  const rawBody = await req.text();
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorOpenAI("invalid JSON body", "invalid_request_error", 400);
  }

  let creds;
  try {
    creds = getCreds();
  } catch (e) {
    return errorOpenAI("MAP credentials not configured", "server_error", 503, e);
  }

  const map = setupMapClient(creds);
  let upstream: Response;
  try {
    upstream = await map.chat(body);
  } catch (e) {
    return errorOpenAI("upstream MAP call failed", "upstream_error", 502, e);
  }

  const text = await upstream.text();
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/json");
  const chargeTx = upstream.headers.get("x-map-charge-tx");
  if (chargeTx) headers.set("X-MAP-Charge-Tx", chargeTx);

  return new Response(text, { status: upstream.status, headers });
}

// Models list (gated behind same Bearer to stop discovery scans)
export async function GET(req: NextRequest) {
  const auth = requireBearer(req, "OPENAI_COMPAT_BEARER");
  if (auth) return auth;
  return Response.json({
    object: "list",
    data: [
      { id: "openai/gpt-4o-mini", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "openai/gpt-4o", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "anthropic/claude-haiku-4-5", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "anthropic/claude-sonnet-4-6", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "google/gemini-2.5-flash", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "google/gemini-2.5-pro", object: "model", owned_by: "molecule-agent-proxy" },
    ],
  });
}
