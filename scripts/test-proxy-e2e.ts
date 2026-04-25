#!/usr/bin/env tsx
//
// End-to-end test for the MAP proxy.
// Assumes contracts are deployed and the Next.js dev server is running on :3000.
//
// Steps:
//   1. Mint a fresh ERC-8004 NFT for the user
//   2. Generate a fresh session keypair
//   3. Bind session key to the NFT (RevocationRegistry.bind)
//   4. User wallet signs an EIP-712 delegation for the session key
//   5. Approve USDC if needed
//   6. Sign a chat-completions request body with the session key
//   7. POST to local proxy with proper headers
//   8. Print response + the on-chain charge tx hash
//
// Run: pnpm tsx scripts/test-proxy-e2e.ts

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

const ARC_RPC_URL = process.env.ARC_RPC_URL!;
const PROXY = process.env.PROXY_BASE_URL ?? "http://localhost:3010";
const USER_PK = process.env.PROXY_RELAYER_PRIVATE_KEY as `0x${string}`;

const ADDR = {
  identity: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as `0x${string}`,
  revocation: process.env.NEXT_PUBLIC_REVOCATION_REGISTRY as `0x${string}`,
  vault: process.env.NEXT_PUBLIC_MOLECULE_VAULT as `0x${string}`,
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
        console.log(`  ⏳ ${label} attempt ${i} hit full txpool, sleeping 8s...`);
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

async function main() {
  console.log("=== MAP proxy e2e ===");
  console.log("user wallet:", userAccount.address);
  console.log("contracts:", ADDR);

  // 1. Mint fresh NFT
  console.log("\n[1/7] minting Identity NFT...");
  const mintData = encodeFunctionData({
    abi: IdentityRegistry.abi,
    functionName: "mint",
    args: [userAccount.address, "ipfs://demo-agent-card-v0"],
  });
  const mintHash = await sendWithRetry({ to: ADDR.identity, data: mintData }, "mint");
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
  const minted = parseEventLogs({
    abi: IdentityRegistry.abi,
    eventName: "AgentMinted",
    logs: mintReceipt.logs,
  });
  if (minted.length === 0) throw new Error("no AgentMinted event found");
  const nftId = (minted[0] as { args: { tokenId: bigint } }).args.tokenId;
  console.log(`  ✓ minted NFT id=${nftId}, tx=${mintHash}`);

  // 2. Generate session keypair
  console.log("\n[2/7] generating session keypair...");
  const sessionPk = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPk);
  console.log(`  ✓ session address=${sessionAccount.address}`);

  // 3. Bind session key to NFT
  console.log("\n[3/7] binding session key on-chain...");
  const bindData = encodeFunctionData({
    abi: RevocationRegistry.abi,
    functionName: "bind",
    args: [sessionAccount.address, nftId],
  });
  const bindHash = await sendWithRetry({ to: ADDR.revocation, data: bindData }, "bind");
  await pub.waitForTransactionReceipt({ hash: bindHash });
  console.log(`  ✓ bound, tx=${bindHash}`);

  // 4. Sign delegation
  console.log("\n[4/7] signing EIP-712 delegation...");
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
  const delegationMessage = {
    sessionKey: sessionAccount.address,
    vault: ADDR.vault,
    scope: ["openrouter:openai/*", "openrouter:anthropic/*"],
    capPerDayUSDC: 10_000_000n, // $10
    expiresAt,
    nonce: 1n,
  } as const;
  const signature = await userWallet.signTypedData({
    domain: {
      name: "MoleculeAgentProxy",
      version: "1",
      chainId: arcChain.id,
      verifyingContract: ADDR.vault,
    },
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
    message: delegationMessage,
  });
  console.log(`  ✓ delegation signature: ${signature.slice(0, 16)}...`);

  // 5. Approve USDC for vault if needed
  console.log("\n[5/7] checking USDC allowance...");
  const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
  const allowance = await pub.readContract({
    address: usdc,
    abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
    functionName: "allowance",
    args: [userAccount.address, ADDR.vault],
  });
  console.log(`  current allowance: ${allowance}`);
  if (allowance < 10_000_000n) {
    console.log("  approving max...");
    const approveData = encodeFunctionData({
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [ADDR.vault, (1n << 256n) - 1n],
    });
    const approveHash = await sendWithRetry({ to: usdc, data: approveData }, "approve");
    await pub.waitForTransactionReceipt({ hash: approveHash });
    console.log(`  ✓ approved, tx=${approveHash}`);
  } else {
    console.log("  ✓ already approved");
  }

  // 6. Sign request body with session key
  console.log("\n[6/7] signing request body with session key...");
  const body = JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Reply with exactly the digits 4, 2." }],
    max_tokens: 5,
  });
  const requestNonce = ("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")) as `0x${string}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = keccak256(toBytes(`${body}|${requestNonce}|${timestamp}`));
  const sessionSig = await sessionAccount.signMessage({ message: { raw: digest } });
  console.log(`  ✓ session sig: ${sessionSig.slice(0, 16)}...`);

  // 7. Call the proxy
  console.log("\n[7/7] calling proxy...");
  const delegationPacket = {
    message: {
      sessionKey: delegationMessage.sessionKey,
      vault: delegationMessage.vault,
      scope: delegationMessage.scope,
      capPerDayUSDC: delegationMessage.capPerDayUSDC.toString(),
      expiresAt: delegationMessage.expiresAt.toString(),
      nonce: delegationMessage.nonce.toString(),
    },
    signature,
  };
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
  console.log(`  status: ${res.status}`);
  console.log(`  charge tx: ${res.headers.get("x-map-charge-tx")}`);
  console.log(`  charge block: ${res.headers.get("x-map-charge-block")}`);
  const data = await res.json();
  console.log(`  upstream response:`, JSON.stringify(data, null, 2).slice(0, 600));

  if (res.status === 200) {
    console.log("\n✅ E2E PASSED");
  } else {
    console.log("\n❌ E2E FAILED");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("e2e error:", e);
  process.exit(1);
});
