// Submit MoleculeVault.chargeAndForward(nftId, requestNonce) on-chain.

import {
  encodeFunctionData,
  WaitForTransactionReceiptTimeoutError,
  type Hash,
} from "viem";
import { publicClient, relayerWallet } from "./viem";
import { ADDR, ABI } from "./contracts";

const TRANSIENT_RPC_PATTERNS = [
  /txpool is full/i,
  /nonce too low/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EAI_AGAIN/i,
  /socket hang up/i,
  /fetch failed/i,
  /HttpRequestError/i,
  /\b5\d{2}\b/, // 502/503/504 etc.
];

const RECEIPT_PRIMARY_TIMEOUT_MS = 15_000;
const RECEIPT_FALLBACK_TIMEOUT_MS = 25_000;

/**
 * Distinguishes "definitely didn't land" from "may have landed but we can't confirm".
 * Callers (proxy route) MUST NOT roll back the cap counter on UNCONFIRMED — the TX
 * may be in a mempool waiting to be included.
 */
export class ChargeError extends Error {
  constructor(
    public readonly code: "REJECTED" | "UNCONFIRMED",
    message: string,
    public readonly txHash?: `0x${string}`,
  ) {
    super(message);
  }
}

function isTransient(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return TRANSIENT_RPC_PATTERNS.some((re) => re.test(msg));
}

export async function chargeOnChain(
  nftId: bigint,
  requestNonce: `0x${string}`,
): Promise<{ txHash: Hash; blockNumber: bigint }> {
  const wallet = relayerWallet();
  const data = encodeFunctionData({
    abi: ABI.MoleculeVault,
    functionName: "chargeAndForward",
    args: [nftId, requestNonce],
  });

  // Send with retry. If we never managed to broadcast, throw REJECTED — safe to roll back cap.
  let txHash: Hash | null = null;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      txHash = await wallet.sendTransaction({
        to: ADDR.moleculeVault,
        data,
        account: wallet.account!,
        chain: wallet.chain!,
      });
      break;
    } catch (e) {
      lastErr = e;
      if (!isTransient(e) || attempt === 5) {
        throw new ChargeError("REJECTED", `send failed: ${(e as Error).message ?? e}`);
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  if (!txHash) throw new ChargeError("REJECTED", `send exhausted: ${(lastErr as Error)?.message ?? lastErr}`);

  // Receipt wait — primary attempt + fallback poll. If receipt never confirmed,
  // throw UNCONFIRMED with the txHash (TX may still land later).
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: RECEIPT_PRIMARY_TIMEOUT_MS,
    });
    return { txHash, blockNumber: receipt.blockNumber };
  } catch (e) {
    if (!(e instanceof WaitForTransactionReceiptTimeoutError)) {
      // Some other error (RPC down etc) — treat as UNCONFIRMED to be safe
      throw new ChargeError("UNCONFIRMED", `receipt wait error: ${(e as Error).message ?? e}`, txHash);
    }
    const start = Date.now();
    while (Date.now() - start < RECEIPT_FALLBACK_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 1000));
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
      if (receipt) return { txHash, blockNumber: receipt.blockNumber };
    }
    throw new ChargeError(
      "UNCONFIRMED",
      `receipt not found after ${RECEIPT_PRIMARY_TIMEOUT_MS + RECEIPT_FALLBACK_TIMEOUT_MS}ms; tx may still land`,
      txHash,
    );
  }
}

export async function ensureUsdcApproval(): Promise<Hash | null> {
  const wallet = relayerWallet();
  const owner = wallet.account!.address;
  const allowance = (await publicClient.readContract({
    address: ADDR.usdc,
    abi: [
      {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    functionName: "allowance",
    args: [owner, ADDR.moleculeVault],
  })) as bigint;
  if (allowance >= 1_000_000n) return null;
  const data = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
    ] as const,
    functionName: "approve",
    args: [ADDR.moleculeVault, (1n << 256n) - 1n],
  });
  const hash = await wallet.sendTransaction({
    to: ADDR.usdc,
    data,
    account: wallet.account!,
    chain: wallet.chain!,
  });
  await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
  return hash;
}
