"use client";

import { useEffect, useState } from "react";
import type { EthereumProvider } from "../types/window";

const ARC_TESTNET = 5042002;
const ARC_TESTNET_HEX = `0x${ARC_TESTNET.toString(16)}`;
const STORAGE_KEY = "map.openrouter-key";

/**
 * Pick the MetaMask provider when multiple wallet extensions are installed.
 * Many users have MetaMask + Core (Avalanche evmAsk.js) + Coinbase Wallet +
 * Rabby + Brave Wallet all fighting over `window.ethereum`. The first one
 * that injects wins, but its multiplexer often hangs or errors. We walk
 * `providers[]` (EIP-5749) and prefer MetaMask when present.
 */
function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0];
  }
  return eth;
}

export default function GetStarted() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "switch" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Reload existing key on mount (just for the address that's stored)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { address: string; key: string };
      setSavedFor(parsed.address);
    } catch {
      /* ignore */
    }
  }, []);

  // React to wallet account / chain changes
  useEffect(() => {
    const eth = getProvider();
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress((accounts?.[0] as `0x${string}` | undefined) ?? null);
    };
    const onChain = (...args: unknown[]) => {
      const cid = args[0] as string;
      setChainId(parseInt(cid, 16));
    };
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = async () => {
    setErr(null);
    const eth = getProvider();
    if (!eth) {
      setErr("No wallet detected. Install MetaMask at metamask.io and reload.");
      return;
    }
    if (!eth.isMetaMask) {
      setErr(
        `Wallet detected (${eth.isCoinbaseWallet ? "Coinbase" : eth.isBraveWallet ? "Brave" : eth.isRabby ? "Rabby" : eth.isAvalanche ? "Core/Avalanche" : "unknown"}) but MetaMask wasn't found. Install MetaMask or disable other wallet extensions.`,
      );
      return;
    }
    setBusy("connect");
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        setErr("Connection canceled in MetaMask.");
        return;
      }
      const addr = (accounts[0] as `0x${string}`).toLowerCase() as `0x${string}`;
      const cid = parseInt((await eth.request({ method: "eth_chainId" })) as string, 16);
      setAddress(addr);
      setChainId(cid);
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const switchToArc = async () => {
    setErr(null);
    const eth = getProvider();
    if (!eth) return;
    setBusy("switch");
    try {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_TESTNET_HEX }],
        });
      } catch (switchErr) {
        // Chain not in MetaMask — add it.
        const code = (switchErr as { code?: number }).code;
        if (code === 4902 || code === -32603) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ARC_TESTNET_HEX,
                chainName: "Arc Testnet",
                nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
                rpcUrls: ["https://rpc.testnet.arc.network"],
                blockExplorerUrls: ["https://testnet.arcscan.app"],
              },
            ],
          });
        } else {
          throw switchErr;
        }
      }
      const cid = parseInt((await eth.request({ method: "eth_chainId" })) as string, 16);
      setChainId(cid);
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const saveKey = () => {
    setErr(null);
    if (!address) {
      setErr("Connect your wallet first.");
      return;
    }
    if (!openRouterKey.startsWith("sk-or-")) {
      setErr("That doesn't look like an OpenRouter key (should start with 'sk-or-').");
      return;
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ address, key: openRouterKey, savedAt: new Date().toISOString() }),
    );
    setSavedFor(address);
    setOpenRouterKey("");
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedFor(null);
  };

  const isCorrectChain = chainId === ARC_TESTNET;

  return (
    <section className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Get started</h2>
        <span className="text-xs text-neutral-500">demo build · keys stored client-side only</span>
      </div>

      {/* Step 1: Connect wallet */}
      <div className="space-y-2">
        <p className="text-sm text-neutral-300">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-xs">
            1
          </span>
          Connect your wallet
        </p>
        {!address ? (
          <button
            onClick={connect}
            disabled={busy === "connect"}
            className="rounded-lg border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/10 px-4 py-2 text-sm font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/20 disabled:opacity-50"
          >
            {busy === "connect" ? "connecting…" : "Connect MetaMask"}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-xs text-neutral-300">
              ✓ {address.slice(0, 6)}…{address.slice(-4)}
            </p>
            {!isCorrectChain && (
              <div className="space-y-1">
                <p className="text-xs text-amber-300">
                  Wallet is on chain {chainId}. MAP runs on Arc Testnet ({ARC_TESTNET}).
                </p>
                <button
                  onClick={switchToArc}
                  disabled={busy === "switch"}
                  className="rounded-lg border border-amber-700/40 bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
                >
                  {busy === "switch" ? "switching…" : "Switch to Arc Testnet"}
                </button>
              </div>
            )}
            {isCorrectChain && (
              <p className="text-xs text-emerald-400">✓ on Arc Testnet</p>
            )}
          </div>
        )}
      </div>

      {/* Step 2: OpenRouter key */}
      <div className="space-y-2">
        <p className="text-sm text-neutral-300">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-xs">
            2
          </span>
          Paste your <a className="text-[var(--color-usdc)] underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter API key</a>
        </p>
        {savedFor ? (
          <div className="space-y-1">
            <p className="text-xs text-emerald-400">
              ✓ key saved for {savedFor.slice(0, 6)}…{savedFor.slice(-4)}
            </p>
            <button
              onClick={clearKey}
              className="text-xs text-neutral-500 underline hover:text-neutral-300"
            >
              clear
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                placeholder="sk-or-v1-…"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                disabled={!address}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 pr-14 font-mono text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                disabled={!address || !openRouterKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
                tabIndex={-1}
              >
                {showKey ? "hide" : "show"}
              </button>
            </div>
            <button
              onClick={saveKey}
              disabled={!address || !openRouterKey}
              className="rounded-lg border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/10 px-4 py-2 text-sm font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/20 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Step 3 — link to live demo agent */}
      <div className="space-y-2 border-t border-neutral-800 pt-4">
        <p className="text-sm text-neutral-300">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-xs">
            3
          </span>
          See the live demo agent
        </p>
        <div className="flex gap-3">
          <a
            href="/agent/5?sessionKey=0x070a864B45D3244eF8e68F91cAeBa3a0663D1225"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
          >
            Open dashboard →
          </a>
          <a
            href="https://github.com/molecule-protocol/molecule-agent-proxy"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
          >
            View on GitHub
          </a>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {err}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-neutral-500">
        <strong>v0.1 (this build):</strong> wallet connection live; OpenRouter key kept in browser localStorage only, not sent to MAP.<br />
        <strong>v1.0 roadmap:</strong> Mint your ERC-8004 NFT, bind attestations, sign session-key delegation, and store your OpenRouter key encrypted server-side via KMS — all from this page.
      </p>
    </section>
  );
}
