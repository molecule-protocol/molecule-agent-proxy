import GetStarted from "./get-started";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      {/* Top nav — gives the landing visitor an immediate path to the pitch */}
      <nav className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-usdc)]">
          Molecule Agent Proxy
        </p>
        <div className="flex gap-2 text-xs">
          <a
            href="/pitch"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/10 px-3 py-1.5 font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/20"
          >
            Pitch ↗
          </a>
          <a
            href="/agent/5?sessionKey=0x070a864B45D3244eF8e68F91cAeBa3a0663D1225"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-neutral-700 px-3 py-1.5 font-medium text-neutral-300 hover:bg-neutral-800"
          >
            Dashboard ↗
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

      <header className="space-y-3">
        <h1 className="text-5xl font-semibold leading-tight">
          Identity-gated, key-free API access for AI agents.
        </h1>
        <p className="text-lg text-neutral-400">
          Per-call nano-payments in USDC on Arc. Built on ERC-8004 + zkTLS.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-lg font-medium">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-neutral-300">
          <li>Connect your wallet, mint an ERC-8004 Identity NFT</li>
          <li>Bind privacy-preserving attestations via Reclaim zkTLS</li>
          <li>Sign one scoped session-key delegation</li>
          <li>Your agent calls OpenAI / Anthropic / anything — without ever holding a key</li>
          <li>Each call: identity-verified on Arc, charged $0.0005 USDC, audited on-chain</li>
        </ol>
      </section>

      <GetStarted />

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <p className="text-sm text-neutral-400">
          Built for the{" "}
          <a
            className="text-[var(--color-usdc)] underline"
            href="https://lablab.ai/ai-hackathons/nano-payments-arc"
          >
            Agentic Economy on Arc
          </a>{" "}
          hackathon. Track: Per-API Monetization Engine.
        </p>
      </section>
    </main>
  );
}
