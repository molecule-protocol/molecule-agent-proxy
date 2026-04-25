#!/usr/bin/env tsx
//
// Demo loop: makes N proxy calls in a row, each producing one on-chain charge TX.
// Reuses the same NFT + delegation setup from the previous e2e run if available,
// otherwise sets up fresh. Outputs a CSV of (i, status, txHash, latencyMs) to stdout.
//
// Usage:
//   pnpm tsx scripts/demo-loop.ts                # default: 60 calls
//   N=100 pnpm tsx scripts/demo-loop.ts          # 100 calls
//   GAP_MS=300 N=80 pnpm tsx scripts/demo-loop.ts

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "apps/web/.env.local") });

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  encodeFunctionData,
  keccak256,
  toBytes,
  parseAbi,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import IdentityRegistry from "../apps/web/src/abi/IdentityRegistry.json" with { type: "json" };
import RevocationRegistry from "../apps/web/src/abi/RevocationRegistry.json" with { type: "json" };

const N = Number(process.env.N ?? 60);
const GAP_MS = Number(process.env.GAP_MS ?? 250);
const ARC_RPC_URL = process.env.ARC_RPC_URL!;
const PROXY = process.env.PROXY_BASE_URL ?? "http://localhost:3010";
const USER_PK = process.env.PROXY_RELAYER_PRIVATE_KEY as `0x${string}`;

const ADDR = {
  identity: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as `0x${string}`,
  revocation: process.env.NEXT_PUBLIC_REVOCATION_REGISTRY as `0x${string}`,
  vault: process.env.NEXT_PUBLIC_MOLECULE_VAULT as `0x${string}`,
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
};

const arcChain = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
});

const pub = createPublicClient({ chain: arcChain, transport: http(ARC_RPC_URL) });
const userAccount = privateKeyToAccount(USER_PK);
const userWallet = createWalletClient({ account: userAccount, chain: arcChain, transport: http(ARC_RPC_URL) });

async function sendWithRetry(args: { to: `0x${string}`; data: `0x${string}` }, label: string): Promise<`0x${string}`> {
  for (let i = 1; i <= 6; i++) {
    try {
      return await userWallet.sendTransaction(args);
    } catch (e: unknown) {
      const msg = String((e as Error).message ?? e);
      if (msg.includes("txpool is full") && i < 6) {
        console.error(`  ⏳ ${label} attempt ${i} hit full txpool, sleeping 8s...`);
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

async function setup() {
  console.error("[setup] minting fresh NFT + binding session key...");
  const mintData = encodeFunctionData({
    abi: IdentityRegistry.abi,
    functionName: "mint",
    args: [userAccount.address, "ipfs://demo-loop"],
  });
  const mintHash = await sendWithRetry({ to: ADDR.identity, data: mintData }, "mint");
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
  const minted = parseEventLogs({ abi: IdentityRegistry.abi, eventName: "AgentMinted", logs: mintReceipt.logs });
  const nftId = (minted[0] as { args: { tokenId: bigint } }).args.tokenId;

  const sessionPk = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPk);

  const bindData = encodeFunctionData({
    abi: RevocationRegistry.abi,
    functionName: "bind",
    args: [sessionAccount.address, nftId],
  });
  const bindHash = await sendWithRetry({ to: ADDR.revocation, data: bindData }, "bind");
  await pub.waitForTransactionReceipt({ hash: bindHash });

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
  const message = {
    sessionKey: sessionAccount.address,
    vault: ADDR.vault,
    scope: ["openrouter:openai/*"],
    capPerDayUSDC: 1_000_000_000n, // $1000 cap (lots of headroom for demo)
    expiresAt,
    nonce: BigInt(Date.now()),
  } as const;
  const signature = await userWallet.signTypedData({
    domain: { name: "MoleculeAgentProxy", version: "1", chainId: arcChain.id, verifyingContract: ADDR.vault },
    types: {
      Delegation: [
        { name: "sessionKey", type: "address" },
        { name: "vault", type: "address" },
        { name: "scope", type: "string[]" },
        { name: "capPerDayUSDC", type: "uint64" },
        { name: "expiresAt", type: "uint64" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "Delegation",
    message,
  });

  // Pre-approve USDC if not already
  const allowance = await pub.readContract({
    address: ADDR.usdc,
    abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
    functionName: "allowance",
    args: [userAccount.address, ADDR.vault],
  });
  if (allowance < 1_000_000n) {
    const approveData = encodeFunctionData({
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [ADDR.vault, (1n << 256n) - 1n],
    });
    const approveHash = await sendWithRetry({ to: ADDR.usdc, data: approveData }, "approve");
    await pub.waitForTransactionReceipt({ hash: approveHash });
  }

  console.error(`[setup] nft=${nftId} session=${sessionAccount.address}`);
  return { nftId, sessionAccount, message, signature };
}

async function callOnce(
  nftId: bigint,
  sessionAccount: ReturnType<typeof privateKeyToAccount>,
  message: { sessionKey: `0x${string}`; vault: `0x${string}`; scope: readonly string[]; capPerDayUSDC: bigint; expiresAt: bigint; nonce: bigint },
  signature: `0x${string}`,
  i: number,
): Promise<{ status: number; txHash: string | null; latencyMs: number }> {
  const body = JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: `Reply with the integer ${i}` }],
    max_tokens: 4,
  });
  const requestNonce = ("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")) as `0x${string}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = keccak256(toBytes(`${body}|${requestNonce}|${timestamp}`));
  const sessionSig = await sessionAccount.signMessage({ message: { raw: digest } });

  const delegationPacket = {
    message: {
      sessionKey: message.sessionKey,
      vault: message.vault,
      scope: message.scope,
      capPerDayUSDC: message.capPerDayUSDC.toString(),
      expiresAt: message.expiresAt.toString(),
      nonce: message.nonce.toString(),
    },
    signature,
  };

  const t0 = Date.now();
  const res = await fetch(`${PROXY}/api/proxy/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MAP-Delegation": Buffer.from(JSON.stringify(delegationPacket)).toString("base64"),
      "X-MAP-Session-Sig": sessionSig,
      "X-MAP-Nonce": requestNonce,
      "X-MAP-Timestamp": timestamp.toString(),
      "X-MAP-NFT-Id": nftId.toString(),
    },
    body,
  });
  const latencyMs = Date.now() - t0;
  return { status: res.status, txHash: res.headers.get("x-map-charge-tx"), latencyMs };
}

async function main() {
  const { nftId, sessionAccount, message, signature } = await setup();
  console.error(`[loop] running ${N} calls with ${GAP_MS}ms gap...`);
  console.log("i,status,txHash,latencyMs");
  let ok = 0, fail = 0;
  for (let i = 1; i <= N; i++) {
    try {
      const r = await callOnce(nftId, sessionAccount, message, signature, i);
      console.log(`${i},${r.status},${r.txHash},${r.latencyMs}`);
      r.status === 200 ? ok++ : fail++;
    } catch (e) {
      console.log(`${i},error,,${String(e).slice(0, 60).replace(/,/g, ";")}`);
      fail++;
    }
    if (i < N) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  console.error(`\n[done] ok=${ok} fail=${fail} of ${N}`);
}

main().catch((e) => { console.error("demo-loop fatal:", e); process.exit(1); });
