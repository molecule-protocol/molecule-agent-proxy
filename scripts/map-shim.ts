#!/usr/bin/env tsx
//
// MAP shim — local OpenAI-API-compatible proxy that wraps requests with MAP
// authentication and forwards to the real MAP proxy.
//
// Why: agent runtimes (OpenClaw, LangGraph, custom) speak OpenAI/Anthropic
// SDK conventions. They don't know about MAP's session-key signing. The shim
// lets you point any agent at `OPENAI_BASE_URL=http://localhost:9999/v1` and
// it Just Works — no code changes in the agent.
//
// Usage:
//   pnpm tsx scripts/setup-demo-credentials.ts          # one-time
//   pnpm tsx scripts/map-shim.ts                        # start shim on :9999
//
// Then in any OpenAI-SDK-compatible agent:
//   OPENAI_BASE_URL=http://localhost:9999/v1
//   OPENAI_API_KEY=anything-ignored

import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
config({ path: resolve(process.cwd(), "apps/web/.env.local") });

import { setupMapClient, type MapCredentials } from "../packages/map-skill/src/index.js";

const PORT = Number(process.env.SHIM_PORT ?? 9999);
const credsPath = resolve(process.cwd(), "scripts/.demo-credentials.json");

let creds: MapCredentials;
try {
  const raw = JSON.parse(readFileSync(credsPath, "utf8"));
  creds = {
    nftId: BigInt(raw.nftId),
    sessionPrivateKey: raw.sessionPrivateKey,
    delegation: {
      message: {
        sessionKey: raw.delegation.message.sessionKey,
        vault: raw.delegation.message.vault,
        scope: raw.delegation.message.scope,
        capPerDayUSDC: BigInt(raw.delegation.message.capPerDayUSDC),
        expiresAt: BigInt(raw.delegation.message.expiresAt),
        nonce: BigInt(raw.delegation.message.nonce),
      },
      signature: raw.delegation.signature,
    },
    proxyUrl: raw.proxyUrl,
  };
} catch (e) {
  console.error(`✗ could not load ${credsPath}`);
  console.error(`  run: pnpm tsx scripts/setup-demo-credentials.ts`);
  process.exit(1);
}

const map = setupMapClient(creds);

console.log(`MAP shim starting on http://localhost:${PORT}`);
console.log(`  → forwarding to ${creds.proxyUrl}/api/proxy/v1/...`);
console.log(`  agent NFT id: ${creds.nftId}`);
console.log(`  session key: ${creds.delegation.message.sessionKey}`);
console.log(`  delegation expires: ${new Date(Number(creds.delegation.message.expiresAt) * 1000).toISOString()}`);
console.log(`\nUse in any agent runtime:`);
console.log(`  OPENAI_BASE_URL=http://localhost:${PORT}/v1`);
console.log(`  OPENAI_API_KEY=anything-ignored\n`);

createServer(async (req, res) => {
  const t0 = Date.now();
  const path = req.url ?? "/";
  // Accept either /v1/chat/completions (OpenAI convention) or /chat/completions
  if (req.method !== "POST" || !path.endsWith("/chat/completions")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found", expected: "POST /v1/chat/completions" }));
    return;
  }

  // Read body
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");

  // Forward via MAP-signed fetch
  try {
    const upstream = await map.chat(JSON.parse(body));
    const text = await upstream.text();
    const chargeTx = upstream.headers.get("x-map-charge-tx");
    const elapsed = Date.now() - t0;
    console.log(`${new Date().toISOString()} ${upstream.status} ${elapsed}ms charge=${chargeTx?.slice(0, 14)}…`);
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "X-MAP-Charge-Tx": chargeTx ?? "",
      "X-MAP-Elapsed-Ms": String(elapsed),
    });
    res.end(text);
  } catch (e) {
    const elapsed = Date.now() - t0;
    console.error(`${new Date().toISOString()} 502 ${elapsed}ms ERR ${String(e).slice(0, 80)}`);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "shim_error", detail: String(e) }));
  }
}).listen(PORT, () => {
  console.log(`✓ listening on :${PORT}\n`);
});
