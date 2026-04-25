#!/usr/bin/env tsx
//
// "Attacker" demo script — used during the steal-the-key recording beat.
//
// Reads MAP credentials from `scripts/.demo-credentials.json` (the same creds
// the legit OpenClaw uses), then hammers the *signed* MAP proxy path with N
// requests. Before revocation: succeeds (the script possesses the session
// private key). After revocation: every call returns `MAP 401: REVOKED`.
//
// Usage:
//   pnpm tsx scripts/attacker.ts                # 5 calls, 800ms gap
//   N=10 pnpm tsx scripts/attacker.ts           # 10 calls
//   GAP_MS=300 N=20 pnpm tsx scripts/attacker.ts

import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
config({ path: resolve(process.cwd(), "apps/web/.env.local") });

import { setupMapClient, type MapCredentials } from "../packages/map-skill/src/index.js";

const N = Number(process.env.N ?? 5);
const GAP_MS = Number(process.env.GAP_MS ?? 800);

function loadCreds(): MapCredentials {
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/.demo-credentials.json"), "utf8"));
  return {
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
    proxyUrl:
      process.env.PROXY_BASE_URL ??
      process.env.NEXT_PUBLIC_PROXY_BASE_URL ??
      raw.proxyUrl ??
      "http://localhost:3010",
  };
}

async function main() {
  const creds = loadCreds();
  const map = setupMapClient(creds);

  console.log("=== ATTACKER ===");
  console.log(`Stolen session key: ${creds.delegation.message.sessionKey}`);
  console.log(`Target NFT:         ${creds.nftId}`);
  console.log(`Calls to attempt:   ${N}`);
  console.log(`Proxy:              ${creds.proxyUrl}`);
  console.log("");

  let ok = 0;
  let blocked = 0;
  for (let i = 1; i <= N; i++) {
    const t0 = Date.now();
    try {
      const res = await map.chat({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: `attacker probe ${i}` }],
        max_tokens: 4,
      });
      const elapsed = Date.now() - t0;
      const code = res.status;
      const tx = res.headers.get("x-map-charge-tx");
      if (code === 200) {
        console.log(`[${String(i).padStart(2)}] ${code} ${elapsed}ms  ✓ stolen-key call SUCCEEDED — charge=${tx?.slice(0, 14)}…`);
        ok++;
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
        const errCode = body?.error?.code ?? "ERROR";
        console.log(`[${String(i).padStart(2)}] ${code} ${elapsed}ms  ✗ BLOCKED: ${errCode}`);
        blocked++;
      }
    } catch (e) {
      console.log(`[${String(i).padStart(2)}]  ${Date.now() - t0}ms  ✗ NETWORK ERR: ${(e as Error).message}`);
      blocked++;
    }
    if (i < N) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  console.log("");
  console.log(`=== Result: ${ok} succeeded, ${blocked} blocked ===`);
  if (blocked === N) {
    console.log("All calls blocked. Session key was revoked or out of scope/cap. Damage = 0.");
  } else if (ok === N) {
    console.log("All calls succeeded — session is ACTIVE. Click Revoke on the dashboard to lock attacker out.");
  }
}

main().catch((e) => {
  console.error("attacker fatal:", e);
  process.exit(1);
});
