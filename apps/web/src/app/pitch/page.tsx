// 5-section scrollable pitch deck. Each section is one "slide" (~85vh).
// Public URL: /pitch — meant to be shared in submission + X post.

export const metadata = {
  title: "MAP — Pitch · Molecule Agent Proxy",
  description:
    "Identity-gated, key-free API access for AI agents. Per-call nano-payments in USDC on Arc. Agentic Economy on Arc hackathon — Per-API Monetization Engine track.",
};

const DEMO_URL =
  "/agent/5?sessionKey=0x070a864B45D3244eF8e68F91cAeBa3a0663D1225";

export default function PitchPage() {
  return (
    <main className="min-h-screen scroll-smooth bg-neutral-950 text-neutral-100">
      <Nav />
      <Slide1Hook />
      <Slide2Product />
      <Slide3Architecture />
      <Slide4Math />
      <Slide5Roadmap />
      <Footer />
    </main>
  );
}

/* ── nav (fixed, faint) ─────────────────────────────────────────────────── */

function Nav() {
  const items = [
    { href: "#hook", label: "Problem" },
    { href: "#product", label: "MAP" },
    { href: "#architecture", label: "How it works" },
    { href: "#math", label: "Why Arc" },
    { href: "#roadmap", label: "Roadmap" },
  ];
  return (
    <nav className="fixed top-0 left-0 z-50 flex w-full items-center justify-between border-b border-neutral-800/60 bg-neutral-950/70 px-6 py-3 backdrop-blur">
      <a href="/" className="text-xs font-medium uppercase tracking-widest text-[var(--color-usdc)]">
        Molecule Agent Proxy
      </a>
      <div className="hidden gap-5 text-xs text-neutral-400 sm:flex">
        {items.map((i) => (
          <a key={i.href} href={i.href} className="hover:text-neutral-100">
            {i.label}
          </a>
        ))}
      </div>
      <a
        href={DEMO_URL}
        className="rounded-md border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/20"
      >
        Live demo →
      </a>
    </nav>
  );
}

/* ── slide 1: hook ──────────────────────────────────────────────────────── */

function Slide1Hook() {
  return (
    <section
      id="hook"
      className="flex min-h-[100vh] flex-col justify-center px-8 pt-24 pb-16 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">
        The problem
      </p>
      <h1 className="max-w-5xl text-5xl font-semibold leading-tight sm:text-7xl">
        Every AI agent holds API keys.
        <br />
        <span className="text-neutral-500">Every key is a leak waiting to happen.</span>
      </h1>
      <div className="mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        <Stat value="$47k" label="Avg. leaked-key bill" />
        <Stat value="weeks" label="Detection time today" />
        <Stat value="0" label="Identity layer in any current AI gateway" />
      </div>
    </section>
  );
}

/* ── slide 2: product ──────────────────────────────────────────────────── */

function Slide2Product() {
  return (
    <section
      id="product"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-[var(--color-usdc)]">
        Molecule Agent Proxy
      </p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight sm:text-6xl">
        Identity-gated, key-free API access
        <br />
        for AI agents.
      </h2>
      <p className="mt-6 max-w-3xl text-xl text-neutral-400">
        Per-call nano-payments in USDC on{" "}
        <strong className="text-neutral-100">Arc</strong>. Built on{" "}
        <a
          className="text-[var(--color-usdc)] underline"
          href="https://eips.ethereum.org/EIPS/eip-8004"
          target="_blank"
          rel="noreferrer"
        >
          ERC-8004
        </a>{" "}
        + zkTLS via{" "}
        <a
          className="text-[var(--color-usdc)] underline"
          href="https://reclaimprotocol.org"
          target="_blank"
          rel="noreferrer"
        >
          Reclaim Protocol
        </a>
        .
      </p>

      <div className="mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
        <Card title="No keys in env files">
          Agent never holds OpenAI / Anthropic / OpenRouter keys. Server-side
          KMS-wrapped vault decrypts per call.
        </Card>
        <Card title="Bounded blast radius">
          Session-key delegation scoped by upstream + capped by daily USDC +
          time-limited. Leak = $5/day max, not $47k.
        </Card>
        <Card title="Instant recovery">
          Revoke on-chain in one TX (~2s on Arc). The next attacker call fails;
          your agent rotates and keeps going.
        </Card>
      </div>

      <div className="mt-10 flex gap-3">
        <a
          href={DEMO_URL}
          className="rounded-lg border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/15 px-5 py-2.5 text-sm font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/25"
        >
          See the live demo →
        </a>
        <a
          href="https://github.com/molecule-protocol/molecule-agent-proxy"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
        >
          GitHub
        </a>
      </div>
    </section>
  );
}

/* ── slide 3: architecture ──────────────────────────────────────────────── */

function Slide3Architecture() {
  return (
    <section
      id="architecture"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">
        How it works
      </p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        One delegation. Per-call signing.
        <br />
        <span className="text-neutral-500">On-chain audit + revoke.</span>
      </h2>

      {/* Architecture diagram (ASCII-style, visually clean) */}
      <div className="mt-12 max-w-5xl overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <pre className="text-xs leading-relaxed text-neutral-300 sm:text-sm">{`
  USER  ──── one-time setup (off-chain or one TX) ──────────▶
   │      • mint ERC-8004 NFT     (1 TX)
   │      • bind attestations     (Reclaim zkTLS, on-chain hash)
   │      • sign delegation       (EIP-712, no TX)
   │            { sessionKey, vault, scope, cap, ttl, nonce }
   │
   │      delegation bundle handed to agent runtime
   ▼
  AGENT  (OpenClaw / LangChain / Hermes / custom)
   │       per call: sign(body || nonce || timestamp) with sessionKey
   │       POST /api/proxy/v1/chat/completions
   ▼
  MAP PROXY  (Vercel + Arc)
   1. verify session-key sig    (off-chain)
   2. verify delegation sig     (off-chain)
   3. check scope, cap, expiry  (off-chain)
   4. check revocation          (on-chain read)
   5. charge USDC nano-payment  (on-chain TX, ~$0.0005)
   6. forward to OpenRouter     (KMS-decrypted upstream key)
   7. emit Charged event        (live feed sees it in ~2s)
`}</pre>
      </div>

      <div className="mt-8 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
        <Card title="Session-key delegation (EIP-7702-compatible)">
          User signs ONE EIP-712 message with their primary wallet. The agent
          uses a separate session keypair for every subsequent call. Primary
          key never sees per-call traffic.
        </Card>
        <Card title="On-chain receipts you can audit">
          Every call emits a <code>Charged</code> event on Arc. Dashboard streams
          them via SSE. Judges hit the public URL and see real-time activity from
          the OpenClaw demo.
        </Card>
      </div>
    </section>
  );
}

/* ── slide 4: math ──────────────────────────────────────────────────────── */

function Slide4Math() {
  return (
    <section
      id="math"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 bg-gradient-to-b from-neutral-950 to-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">
        Why Arc
      </p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        This business does not exist
        <br />
        on any other chain.
      </h2>

      <div className="mt-12 max-w-5xl overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/70">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-5 py-4 text-left">Approach</th>
              <th className="px-5 py-4 text-left">Per-call cost</th>
              <th className="px-5 py-4 text-left">Identity layer</th>
              <th className="px-5 py-4 text-left">Recovery on leak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            <Row
              cells={[
                "OpenAI key in env",
                "$0 (until breach)",
                "—",
                "days, after Stripe email",
              ]}
            />
            <Row
              cells={[
                "Cloudflare AI Gateway",
                "infra fee",
                "bearer (still leakable)",
                "rotate keys in N services",
              ]}
            />
            <Row
              cells={[
                <strong key="0" className="text-[var(--color-usdc)]">
                  MAP on Arc
                </strong>,
                <strong key="1" className="text-[var(--color-usdc)]">
                  $0.0005 USDC
                </strong>,
                <strong key="2" className="text-[var(--color-usdc)]">
                  ERC-8004 + zkTLS
                </strong>,
                <strong key="3" className="text-[var(--color-usdc)]">
                  one TX (~2s)
                </strong>,
              ]}
              accent
            />
          </tbody>
        </table>
      </div>

      <p className="mt-10 max-w-4xl text-xl text-neutral-300">
        <span className="text-[var(--color-usdc)]">$0.0005</span> per call vs{" "}
        <span className="text-neutral-500">$5</span> gas on Ethereum L1 ={" "}
        <strong className="text-neutral-100">10,000× margin</strong>.
        <br />
        Sub-second finality. USDC-denominated. Arc is the only chain where this exists.
      </p>
    </section>
  );
}

/* ── slide 5: roadmap + founder ─────────────────────────────────────────── */

function Slide5Roadmap() {
  return (
    <section
      id="roadmap"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">
        Roadmap + team
      </p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        Built on a thesis,
        <br />
        not a pivot.
      </h2>

      <div className="mt-12 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs uppercase tracking-widest text-[var(--color-usdc)]">
            Founder
          </h3>
          <p className="text-lg text-neutral-200">Calvin Pak</p>
          <p className="mt-1 text-sm text-neutral-400">
            Founder, Molecule Protocol — NFT proof tokens → on-chain SDL
            allowlist → Credit3 → ZKP. Agent identity has been the through-line
            for years; MAP is the execution layer that makes it economical.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-neutral-400">
            <li>• Speaker, ETH Denver 2024 — data sovereignty</li>
            <li>• Speaker, EdCon 2024 — data sovereignty</li>
            <li>
              • Thesis:{" "}
              <a
                className="text-[var(--color-usdc)] underline"
                target="_blank"
                rel="noreferrer"
                href="https://paragraph.com/@calvinpak/data-ownership-an-urgent-call-to-reclaim-profits-from-your-data"
              >
                data ownership
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-widest text-[var(--color-usdc)]">
            Roadmap
          </h3>
          <ul className="space-y-3 text-sm text-neutral-300">
            <li>
              <strong>v0.2 — Wallet vault for autonomous agent trading.</strong>{" "}
              Agent's private key lives behind MAP. User signs a delegation with
              spend caps + scope. Agent can't drain the wallet and can't be
              impersonated.
            </li>
            <li>
              <strong>v0.2 — Sandbox runtime: Phala TEE or Celesto SmolVM.</strong>{" "}
              Agent code runs in a hardware-isolated sandbox holding the PK.
              Compromised agent code can't exfiltrate. MAP gates external API
              calls; Celesto's microVM gates code execution.{" "}
              <a
                className="text-[var(--color-usdc)] underline"
                href="https://github.com/CelestoAI/SmolVM"
                target="_blank"
                rel="noreferrer"
              >
                CelestoAI/SmolVM
              </a>
              .
            </li>
            <li>
              <strong>v0.3 — Multi-chain.</strong> Same architecture on Base,
              Solana via Wormhole. Reputation registry per ERC-8004.
            </li>
            <li>
              <strong>v1.0 — Production launch.</strong> SDKs for OpenClaw,
              Hermes, LangGraph, Claude Agent SDK, AutoGen.
            </li>
          </ul>
        </div>
      </div>

      {/* Future use case: agent autonomous trading */}
      <div className="mt-12 max-w-5xl rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          v0.2 — autonomous agent trading
        </p>
        <h3 className="mt-2 text-2xl font-semibold">
          Agents that can trade without giving them your private key.
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Today: trading bots either run with the PK in plain config (huge leak
          surface) or use exchange-issued API keys (custodial). Neither scales
          to autonomous on-chain agents.
          <br />
          <br />
          MAP + Celesto/SmolVM v0.2: PK lives inside a microVM sandbox. The
          agent inside the sandbox signs transactions with bounded scope (set
          by your delegation). MAP gates every external call — LLM, oracle, DEX
          API — through identity verification + nano-payments. The user retains
          one-click revoke. Same primitive as our LLM-call gating today, applied
          to wallet operations.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>Built for the</span>
        <a
          className="text-[var(--color-usdc)] underline"
          href="https://lablab.ai/ai-hackathons/nano-payments-arc"
          target="_blank"
          rel="noreferrer"
        >
          Agentic Economy on Arc
        </a>
        <span>hackathon.</span>
        <span>Track: Per-API Monetization Engine.</span>
        <span>·</span>
        <span>@buildoncircle · @arc · @lablabai</span>
      </div>
    </section>
  );
}

/* ── footer ─────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-neutral-900 px-8 py-12 text-center text-xs text-neutral-500 sm:px-16">
      <p>
        <a className="text-[var(--color-usdc)] underline" href={DEMO_URL}>
          Open the live dashboard
        </a>{" "}
        ·{" "}
        <a
          className="text-[var(--color-usdc)] underline"
          href="https://github.com/molecule-protocol/molecule-agent-proxy"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </p>
      <p className="mt-4">moleculeprotocol.io</p>
    </footer>
  );
}

/* ── primitives ─────────────────────────────────────────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
      <p className="text-4xl font-semibold text-[var(--color-usdc)]">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-wider text-neutral-500">{label}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <h3 className="mb-2 text-base font-medium text-neutral-100">{title}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

function Row({
  cells,
  accent,
}: {
  cells: React.ReactNode[];
  accent?: boolean;
}) {
  return (
    <tr className={accent ? "bg-[var(--color-usdc)]/5" : ""}>
      {cells.map((c, i) => (
        <td key={i} className="px-5 py-4 text-neutral-300">
          {c}
        </td>
      ))}
    </tr>
  );
}
