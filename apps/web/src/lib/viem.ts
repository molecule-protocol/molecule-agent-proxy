// Shared viem clients for Arc.
//
// Uses fallback transport across multiple Arc RPCs because Arc testnet's
// public node frequently returns "txpool is full" — viem rotates to the next
// RPC automatically. Order: user-configured first, then known alternates.
import { createPublicClient, createWalletClient, http, fallback, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_RPC_URL, ARC_CHAIN_ID, relayerKey } from "./contracts";

const KNOWN_ARC_RPCS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
];

const rpcUrls = Array.from(new Set([ARC_RPC_URL, ...KNOWN_ARC_RPCS]));

export const arcChain = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: rpcUrls } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

const transport = fallback(
  rpcUrls.map((url) =>
    http(url, { retryCount: 2, retryDelay: 400, timeout: 15_000 }),
  ),
  { rank: false },
);

export const publicClient = createPublicClient({
  chain: arcChain,
  transport,
});

let _walletClient: ReturnType<typeof createWalletClient> | null = null;

/** Lazy because env may not be set in build-only contexts. */
export function relayerWallet() {
  if (!_walletClient) {
    const account = privateKeyToAccount(relayerKey());
    _walletClient = createWalletClient({
      account,
      chain: arcChain,
      transport,
    });
  }
  return _walletClient;
}
