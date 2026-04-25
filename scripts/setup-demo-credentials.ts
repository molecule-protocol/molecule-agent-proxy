#!/usr/bin/env tsx
//
// One-time MAP credentials setup for the demo:
//   1. Mint an ERC-8004 Identity NFT to the demo user wallet
//   2. Generate a fresh session keypair
//   3. Bind the session key to the NFT on RevocationRegistry
//   4. User wallet signs an EIP-712 delegation
//   5. Approve USDC for MoleculeVault
//   6. Save everything to scripts/.demo-credentials.json
//
// Re-run only when:
//   - Contracts redeployed
//   - Existing session key revoked
//   - Delegation expired
//
// Usage: pnpm tsx scripts/setup-demo-credentials.ts

import { config } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
config({ path: resolve(process.cwd(), "apps/web/.env.local") });

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  encodeFunctionData,
  parseAbi,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import IdentityRegistry from "../apps/web/src/abi/IdentityRegistry.json" with { type: "json" };
import RevocationRegistry from "../apps/web/src/abi/RevocationRegistry.json" with { type: "json" };

const ARC_RPC_URL = process.env.ARC_RPC_URL!;
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
    try { return await userWallet.sendTransaction(args); }
    catch (e) {
      const msg = String((e as Error).message ?? e);
      if (msg.includes("txpool is full") && i < 6) {
        console.log(`  ⏳ ${label} txpool full, sleeping 8s (attempt ${i})...`);
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

async function main() {
  console.log("=== MAP demo credentials setup ===");
  console.log("user:", userAccount.address);

  // 1. Mint NFT
  console.log("\n[1/5] minting NFT...");
  const mintData = encodeFunctionData({
    abi: IdentityRegistry.abi,
    functionName: "mint",
    args: [userAccount.address, "ipfs://map-demo-agent"],
  });
  const mintHash = await sendWithRetry({ to: ADDR.identity, data: mintData }, "mint");
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
  const minted = parseEventLogs({ abi: IdentityRegistry.abi, eventName: "AgentMinted", logs: mintReceipt.logs });
  const nftId = (minted[0] as { args: { tokenId: bigint } }).args.tokenId;
  console.log(`  ✓ nftId=${nftId} tx=${mintHash}`);

  // 2. Session keypair
  console.log("\n[2/5] generating session keypair...");
  const sessionPk = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPk);
  console.log(`  ✓ session=${sessionAccount.address}`);

  // 3. Bind
  console.log("\n[3/5] binding session key on-chain...");
  const bindData = encodeFunctionData({
    abi: RevocationRegistry.abi,
    functionName: "bind",
    args: [sessionAccount.address, nftId],
  });
  const bindHash = await sendWithRetry({ to: ADDR.revocation, data: bindData }, "bind");
  await pub.waitForTransactionReceipt({ hash: bindHash });
  console.log(`  ✓ bound tx=${bindHash}`);

  // 4. Delegation
  console.log("\n[4/5] signing EIP-712 delegation...");
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
  const message = {
    sessionKey: sessionAccount.address,
    vault: ADDR.vault,
    scope: ["openrouter:openai/*", "openrouter:anthropic/*", "openrouter:google/*"],
    // Lowered from $1000 → $5 after security audit (Finding #8). Demo uses
    // ~$0.03/100 calls; $5 leaves room for an extended dry-run and the
    // recorded video while bounding any blast radius if creds leak.
    capPerDayUSDC: 5_000_000n, // $5 in 6-decimal USDC base units
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
  console.log(`  ✓ delegation signed (sig: ${signature.slice(0, 16)}...)`);

  // 5. Approve USDC if needed
  console.log("\n[5/5] checking USDC allowance...");
  const allowance = await pub.readContract({
    address: ADDR.usdc,
    abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
    functionName: "allowance",
    args: [userAccount.address, ADDR.vault],
  });
  if (allowance < 1_000_000n) {
    console.log("  approving max...");
    const approveData = encodeFunctionData({
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [ADDR.vault, (1n << 256n) - 1n],
    });
    const approveHash = await sendWithRetry({ to: ADDR.usdc, data: approveData }, "approve");
    await pub.waitForTransactionReceipt({ hash: approveHash });
    console.log(`  ✓ approved tx=${approveHash}`);
  } else {
    console.log("  ✓ already approved");
  }

  // Save to file
  const credsPath = resolve(process.cwd(), "scripts/.demo-credentials.json");
  writeFileSync(
    credsPath,
    JSON.stringify(
      {
        nftId: nftId.toString(),
        sessionPrivateKey: sessionPk,
        sessionAddress: sessionAccount.address,
        delegation: {
          message: {
            sessionKey: message.sessionKey,
            vault: message.vault,
            scope: message.scope,
            capPerDayUSDC: message.capPerDayUSDC.toString(),
            expiresAt: message.expiresAt.toString(),
            nonce: message.nonce.toString(),
          },
          signature,
        },
        proxyUrl: process.env.PROXY_BASE_URL ?? "http://localhost:3010",
      },
      null,
      2,
    ),
  );
  console.log(`\n✅ saved to ${credsPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
