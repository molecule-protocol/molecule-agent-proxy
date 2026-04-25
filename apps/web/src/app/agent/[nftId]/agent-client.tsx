"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeFunctionData } from "viem";
import RevocationRegistryArtifact from "@/abi/RevocationRegistry.json";

interface AgentState {
  nftId: string;
  owner: `0x${string}`;
  tokenURI: string;
  callCount: number;
  totalFees: number;
  sessionKeys: { sessionKey: `0x${string}`; owner: `0x${string}`; boundAt: number }[];
  focusedSession: {
    sessionKey: `0x${string}`;
    revokedAt: number;
    isRevoked: boolean;
  } | null;
  attestations: {
    attestationHash: `0x${string}`;
    validator: `0x${string}`;
    blockNumber: number;
    txHash: `0x${string}`;
    recordedAt: number;
  }[];
  latestBlock: string;
  contracts: {
    identityRegistry: `0x${string}`;
    moleculeVault: `0x${string}`;
    revocationRegistry: `0x${string}`;
    validationRegistry: `0x${string}`;
  };
  explorerBase: string;
}

interface ChargedEvent {
  txHash: `0x${string}`;
  blockNumber: number;
  requestNonce: `0x${string}`;
  payer: `0x${string}`;
  feeUSDC: string;
  timestamp: number;
  receivedAt: number;
}

export default function AgentClient({
  nftId,
  sessionKey,
}: {
  nftId: string;
  sessionKey: string | null;
}) {
  const [state, setState] = useState<AgentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ChargedEvent[]>([]);
  const [connected, setConnected] = useState<`0x${string}` | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState<string | null>(null);
  const [bindingType, setBindingType] = useState<string | null>(null);
  const [bindMsg, setBindMsg] = useState<string | null>(null);

  // Initial fetch + poll-refresh totals every 5s
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const url = `/api/agent/${nftId}` + (sessionKey ? `?sessionKey=${sessionKey}` : "");
        const res = await fetch(url);
        if (!res.ok) throw new Error(`http ${res.status}`);
        const data = (await res.json()) as AgentState;
        if (alive) setState(data);
      } catch (e) {
        if (alive) setError(String(e));
      }
    };
    refresh();
    const t = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [nftId, sessionKey]);

  // SSE for live charged events. Reconnects with `since=<lastBlock>` so we
  // don't miss events that landed during a transient disconnect.
  useEffect(() => {
    let lastBlock: number | null = null;
    let es: EventSource | null = null;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      const url = `/api/events/${nftId}` + (lastBlock ? `?since=${lastBlock}` : "");
      es = new EventSource(url);
      es.addEventListener("charged", (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as Omit<ChargedEvent, "receivedAt">;
        lastBlock = Math.max(lastBlock ?? 0, data.blockNumber);
        setEvents((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, 100));
      });
      // Browser will auto-reconnect on stream errors; the `since=` param ensures continuity.
    };
    connect();
    return () => {
      alive = false;
      es?.close();
    };
  }, [nftId]);

  const totalSpent = useMemo(() => {
    if (!state) return "0.0000";
    return (state.totalFees / 1_000_000).toFixed(4);
  }, [state]);

  const connect = async () => {
    const eth = window.ethereum;
    if (!eth) {
      setRevokeMsg("install MetaMask first");
      return;
    }
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const addr = accounts[0];
    setConnected(addr.toLowerCase() as `0x${string}`);
  };

  const revoke = async () => {
    if (!sessionKey || !state) return;
    setRevoking(true);
    setRevokeMsg(null);
    try {
      const eth = window.ethereum;
      if (!eth) throw new Error("no wallet");
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const from = accounts[0];

      // Chain-ID check before send. Without this, a MetaMask on Ethereum
      // mainnet would silently send the revoke TX to the wrong chain.
      const ARC_TESTNET = 5042002;
      const ARC_TESTNET_HEX = `0x${ARC_TESTNET.toString(16)}`;
      const chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
      if (parseInt(chainIdHex, 16) !== ARC_TESTNET) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARC_TESTNET_HEX }],
          });
        } catch {
          setRevokeMsg(
            `Wallet is on chain ${parseInt(chainIdHex, 16)}; need ${ARC_TESTNET} (Arc Testnet). Switch in MetaMask and retry.`,
          );
          return;
        }
      }

      // Use viem's encodeFunctionData (safer than hand-rolled selector + padding).
      const data = encodeFunctionData({
        abi: RevocationRegistryArtifact.abi,
        functionName: "revoke",
        args: [sessionKey],
      });

      const txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [{ from, to: state.contracts.revocationRegistry, data }],
      })) as string;
      setRevokeMsg(`✓ revoke tx: ${txHash}`);
    } catch (e) {
      setRevokeMsg(`revoke failed: ${(e as Error).message ?? String(e)}`);
    } finally {
      setRevoking(false);
    }
  };

  if (error) return <main className="p-8 text-red-400">error: {error}</main>;
  if (!state) return <main className="p-8 text-neutral-500">loading agent {nftId}…</main>;

  const isOwner = connected && state.owner.toLowerCase() === connected;
  const focused = state.focusedSession;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Top nav — links to pitch + repo */}
      <nav className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <a href="/" className="text-xs font-medium uppercase tracking-widest text-[var(--color-usdc)]">
          Molecule Agent Proxy
        </a>
        <div className="flex gap-3 text-xs">
          <a
            href="/pitch"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-neutral-700 px-3 py-1.5 font-medium text-neutral-300 hover:bg-neutral-800"
          >
            Pitch ↗
          </a>
          <a
            href="https://github.com/molecule-protocol/molecule-agent-proxy"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-neutral-700 px-3 py-1.5 font-medium text-neutral-300 hover:bg-neutral-800"
          >
            GitHub ↗
          </a>
        </div>
      </nav>

      {/* DEMO MODE banner — honest disclosure that the OpenRouter key is shared in this build */}
      <aside className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-2 text-xs text-amber-200">
        <strong className="font-medium">Demo build:</strong> this dashboard uses one shared OpenRouter key in the proxy backend (held in env). Per-user encrypted key custody (KMS-wrapped) is the production path — same code surface, swap-in-place at <span className="font-mono">apps/web/src/lib/kms.ts</span>.
      </aside>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-[var(--color-usdc)]">
          Molecule Agent Proxy · live monitor
        </p>
        <h1 className="text-3xl font-semibold">Agent #{state.nftId}</h1>
        <p className="text-sm text-neutral-400">
          Owner:{" "}
          <a
            className="font-mono text-neutral-300 hover:text-white"
            target="_blank"
            href={`${state.explorerBase}/address/${state.owner}`}
            rel="noreferrer"
          >
            {state.owner.slice(0, 8)}…{state.owner.slice(-6)}
          </a>{" · "}URI: <span className="font-mono text-neutral-500">{state.tokenURI}</span>
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Total calls" value={state.callCount.toString()} />
        <Kpi label="Total spent (USDC)" value={`$${totalSpent}`} accent />
        <Kpi label="Latest Arc block" value={state.latestBlock} />
      </section>

      {sessionKey && focused && (
        <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-neutral-300">Session key</h2>
              <p className="font-mono text-xs text-neutral-500">{focused.sessionKey}</p>
            </div>
            <Status revoked={focused.isRevoked} revokedAt={focused.revokedAt} />
          </div>

          {!connected && (
            <button
              onClick={connect}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
            >
              Connect wallet to revoke
            </button>
          )}
          {connected && !isOwner && (
            <p className="text-xs text-neutral-500">
              Connected wallet doesn&apos;t match NFT owner — only the owner can revoke.
            </p>
          )}
          {connected && isOwner && !focused.isRevoked && (
            <button
              onClick={revoke}
              disabled={revoking}
              className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-50"
            >
              {revoking ? "revoking…" : "Revoke session key"}
            </button>
          )}
          {revokeMsg && (
            <p className={`text-xs ${revokeMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
              {revokeMsg}
            </p>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-300">Attestations</h2>
          <span className="text-xs text-neutral-500">
            {state.attestations.length} on-chain via ValidationRegistry
          </span>
        </div>
        {state.attestations.length === 0 ? (
          <p className="text-xs text-neutral-500">no attestations bound yet</p>
        ) : (
          <ul className="divide-y divide-neutral-800/60 text-xs">
            {state.attestations.map((a) => (
              <li key={a.txHash} className="flex items-center justify-between gap-3 py-2 font-mono">
                <span className="text-neutral-400">block {a.blockNumber}</span>
                <a
                  className="flex-1 truncate text-neutral-300 hover:text-white"
                  target="_blank"
                  href={`${state.explorerBase}/tx/${a.txHash}`}
                  rel="noreferrer"
                >
                  {a.attestationHash}
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {(["kyc", "company"] as const).map((t) => (
            <button
              key={t}
              disabled={!!bindingType}
              onClick={async () => {
                setBindingType(t);
                setBindMsg(null);
                try {
                  // Use the demo-only bind route (tight rate limit, hardcoded to NFT #5).
                  // The Bearer-gated /api/attestations/bind exists for admin use.
                  const res = await fetch("/api/attestations/bind-demo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nftId: state.nftId, issuerType: t, subject: state.owner }),
                  });
                  const data = await res.json();
                  setBindMsg(
                    res.ok
                      ? `✓ ${t} bound: ${data.txHash.slice(0, 14)}…`
                      : `✗ ${data.error?.code ?? "ERROR"}: ${data.error?.message ?? "see server logs"}`,
                  );
                } catch (e) {
                  setBindMsg(`✗ ${(e as Error).message ?? String(e)}`);
                } finally {
                  setBindingType(null);
                }
              }}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
            >
              {bindingType === t ? `binding ${t}…` : `Bind ${t} attestation`}
            </button>
          ))}
        </div>
        {bindMsg && (
          <p className={`text-xs ${bindMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
            {bindMsg}
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-neutral-500">
          Production wires Reclaim Protocol&apos;s zkTLS layer here — each binding requires a valid ZK proof of the issuer&apos;s TLS response. Hackathon build records the on-chain attestation hash directly; the ZK verifier is a one-line swap in <span className="font-mono">/api/attestations/bind</span>.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-300">Live charge events</h2>
          <span className="text-xs text-neutral-500">{events.length} streamed this session</span>
        </div>
        <ul className="max-h-[480px] divide-y divide-neutral-800/60 overflow-auto text-sm">
          {events.length === 0 && (
            <li className="px-5 py-6 text-center text-neutral-500">waiting for charge events…</li>
          )}
          {events.map((e) => (
            <li key={e.txHash} className="grid grid-cols-12 items-center gap-3 px-5 py-2.5 font-mono">
              <span className="col-span-2 text-xs text-neutral-500">block {e.blockNumber}</span>
              <a
                className="col-span-6 truncate text-xs text-neutral-300 hover:text-white"
                target="_blank"
                href={`${state.explorerBase}/tx/${e.txHash}`}
                rel="noreferrer"
              >
                {e.txHash}
              </a>
              <span className="col-span-2 text-xs text-neutral-400">${e.feeUSDC}</span>
              <span className="col-span-2 text-right text-xs text-neutral-500">
                {new Date(e.receivedAt).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-5 py-3 text-center text-xs text-neutral-400">
        $0.0005 per gated call. The same call costs $5+ in gas on Ethereum L1 — a 10,000× margin.
        This business does not exist on any other chain.
      </p>
    </main>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-[var(--color-usdc)]" : "text-neutral-100"}`}>
        {value}
      </p>
    </div>
  );
}

function Status({ revoked, revokedAt }: { revoked: boolean; revokedAt: number }) {
  if (revoked) {
    return (
      <div className="space-y-0.5 text-right">
        <span className="rounded-full border border-red-700/40 bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-300">
          REVOKED
        </span>
        <p className="text-xs text-neutral-500">at {new Date(revokedAt * 1000).toLocaleTimeString()}</p>
      </div>
    );
  }
  return (
    <span className="rounded-full border border-emerald-700/40 bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
      ACTIVE
    </span>
  );
}
