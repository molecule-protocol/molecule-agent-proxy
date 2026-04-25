// 6-section scrollable pitch deck. Each section is one "slide" (~85vh).
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
      <Slide5WhyArc />
      <Slide2Product />
      <Slide3Architecture />
      <Slide4UseCases />
      <Slide6RoadmapCreator />
      <Footer />
    </main>
  );
}

/* ── nav (fixed, faint) ─────────────────────────────────────────────────── */

function Nav() {
  const items = [
    { href: "#hook", label: "Problem" },
    { href: "#why-arc", label: "Why Arc" },
    { href: "#product", label: "MAP" },
    { href: "#architecture", label: "How it works" },
    { href: "#use-cases", label: "Use cases" },
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
        target="_blank"
        rel="noreferrer"
        className="rounded-md border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/20"
      >
        Live demo ↗
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
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">The problem</p>
      <h1 className="max-w-5xl text-5xl font-semibold leading-tight sm:text-7xl">
        Every AI agent holds API keys.
        <br />
        <span className="text-neutral-500">Every key is a leak waiting to happen.</span>
      </h1>
      <div className="mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        <Stat value="up to $47k" label="Reported per-incident bills" />
        <Stat value="weeks" label="Typical detection time today" />
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
        <Term term="ERC-8004" what="Ethereum's standard for AI agent identity — three on-chain registries (Identity, Reputation, Validation) so anyone can verify who built an agent, what it's qualified to do, and what it's done." />{" "}
        +{" "}
        <Term term="zkTLS" what="Zero-knowledge TLS. Lets you cryptographically prove what an HTTPS server told you (e.g. 'I have a verified Stripe account') without revealing the rest of the response. We use Reclaim Protocol's network." />
        .
      </p>

      <div className="mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
        <Card title="No keys in env files">
          Agent never holds OpenAI / Anthropic / OpenRouter keys. Server-side
          KMS-wrapped vault decrypts per call.
        </Card>
        <Card title="Bounded blast radius">
          <Term term="Session-key delegation" what="Your primary wallet (MetaMask) signs ONE message authorizing a separate session keypair to act for you. The session key is scoped (which APIs), capped (USDC/day), and time-limited." />{" "}
          — leak = $5/day max, not $47k.
        </Card>
        <Card title="Instant recovery">
          Revoke on-chain in one transaction (~2s on Arc). The next attacker
          call fails; your agent rotates and keeps going.
        </Card>
      </div>

      <div className="mt-10 flex gap-3">
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/15 px-5 py-2.5 text-sm font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/25"
        >
          See the live demo ↗
        </a>
        <a
          href="https://github.com/molecule-protocol/molecule-agent-proxy"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
        >
          GitHub ↗
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
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">How it works</p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        One delegation. Per-call signing.
        <br />
        <span className="text-neutral-500">On-chain audit + revoke.</span>
      </h2>

      <div className="mt-12 max-w-5xl overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <pre className="text-xs leading-relaxed text-neutral-300 sm:text-sm">{`
  USER  ──── one-time setup (off-chain or one TX) ──────────▶
   │      • mint ERC-8004 NFT     (1 TX) — your agent's on-chain identity
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
   1. verify session-key sig    (off-chain, instant)
   2. verify delegation sig     (off-chain, instant)
   3. check scope, cap, expiry  (off-chain, instant)
   4. check revocation          (on-chain read, ~50ms)
   5. charge USDC nano-payment  (on-chain TX, ~$0.0005)
   6. forward to OpenRouter     (KMS-decrypted upstream key)
   7. emit Charged event        (live feed sees it in ~2s)
`}</pre>
      </div>

      <div className="mt-8 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
        <Card title="Session-key delegation, EIP-7702-compatible">
          User signs ONE{" "}
          <Term term="EIP-712" what="EIP-712 is the Ethereum standard for human-readable structured-data signatures. MetaMask shows the user the actual fields being signed (sessionKey, scope, cap, expiry) instead of a meaningless hash, so the user knows what they're authorizing." />{" "}
          structured message with their primary wallet (MetaMask). The agent
          uses a separate session keypair for every subsequent call. Compatible
          with{" "}
          <Term term="EIP-7702" what="EIP-7702 (Pectra upgrade, May 2025) lets a regular wallet (EOA) temporarily delegate authority to a contract — the foundation for on-chain session keys with scope and revocation. We use the same data model so future on-chain enforcement is a one-line swap." />{" "}
          for future on-chain enforcement. Primary key never sees per-call
          traffic — and never leaves MetaMask.
        </Card>
        <Card title="On-chain receipts you can audit">
          Every call emits a <code className="text-[var(--color-usdc)]">Charged</code>{" "}
          event on Arc. Dashboard streams them live via Server-Sent Events. Judges
          hit the public URL and see real-time activity from the OpenClaw demo.
        </Card>
      </div>
    </section>
  );
}

/* ── slide 4: use cases ─────────────────────────────────────────────────── */

function Slide4UseCases() {
  return (
    <section
      id="use-cases"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">Use cases</p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        One primitive.
        <br />
        <span className="text-neutral-500">Two markets opened today.</span>
      </h2>

      <div className="mt-12 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        {/* USE CASE 1 — proxy API calls */}
        <div className="rounded-xl border border-[var(--color-usdc)]/30 bg-[var(--color-usdc)]/5 p-6">
          <p className="mb-1 text-xs uppercase tracking-widest text-[var(--color-usdc)]">
            ✓ Live in this demo
          </p>
          <h3 className="text-2xl font-semibold">Key-free API access for agents</h3>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            Your agent (OpenClaw, LangChain, Hermes, Claude Skill, custom)
            calls OpenAI / Anthropic / Google / anything — without ever
            holding the key.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            <strong className="text-neutral-200">Why it matters:</strong>{" "}
            every leaked key in the news could have been bounded to $5/day
            and revoked in two seconds. Today the only patterns are
            "stuff key in env" or "lock to a custodial gateway." MAP gives
            you cryptographic per-call identity with sub-cent settlement.
          </p>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-md border border-[var(--color-usdc)]/40 bg-[var(--color-usdc)]/15 px-4 py-2 text-xs font-medium text-[var(--color-usdc)] hover:bg-[var(--color-usdc)]/25"
          >
            See live activity ↗
          </a>
        </div>

        {/* USE CASE 2 — autonomous trading without giving up PK */}
        <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-6">
          <p className="mb-1 text-xs uppercase tracking-widest text-amber-400">
            v0.2 — same primitive, wallet operations
          </p>
          <h3 className="text-2xl font-semibold">
            Autonomous on-chain trading without giving away your private key
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            Today: trading bots either hold the user's private key in plain
            config (huge leak surface) or use exchange-issued API keys
            (custodial only). Neither scales to autonomous on-chain agents.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            <strong className="text-neutral-200">MAP v0.2:</strong> private
            key stays in MetaMask (or a sandboxed{" "}
            <Term term="microVM" what="A small, hardware-isolated virtual machine that boots in under a second. Lets agent code run with PK access while preventing it from exfiltrating the key. We're integrating Celesto SmolVM as the recommended runtime." />
            ). User signs ONE delegation declaring{" "}
            <em>"this session key may swap on Aave up to $500/day, no other contracts."</em>{" "}
            Agent uses the session key. Compromised agent can't drain the
            wallet — at most $500/day until revoked. <strong className="text-neutral-200">Revoking the session key never requires touching the private key.</strong> The PK in MetaMask is untouched; the user just submits one revoke transaction.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-amber-300/80">
            Pairs natively with{" "}
            <a
              className="underline"
              href="https://github.com/CelestoAI/SmolVM"
              target="_blank"
              rel="noreferrer"
            >
              CelestoAI/SmolVM
            </a>{" "}
            for sandboxed execution and{" "}
            <a
              className="underline"
              href="https://github.com/Phala-Network/erc-8004-tee-agent"
              target="_blank"
              rel="noreferrer"
            >
              Phala Network TEE
            </a>{" "}
            for hardware-attested identity.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── slide 5: why Arc ───────────────────────────────────────────────────── */

function Slide5WhyArc() {
  return (
    <section
      id="why-arc"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 bg-gradient-to-b from-neutral-950 to-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">Why Arc</p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        We&apos;re building exactly
        <br />
        <span className="text-[var(--color-usdc)]">what Arc is for.</span>
      </h2>

      {/* Arc's own thesis */}
      <blockquote className="mt-10 max-w-4xl border-l-4 border-[var(--color-usdc)] bg-neutral-900/50 px-6 py-5 text-base leading-relaxed text-neutral-300">
        <p>
          Arc&apos;s framework leverages{" "}
          <Term term="decentralized identity (DID) standards" what="DIDs let an entity (a person, an agent) own a portable cryptographic identifier that no central authority controls. The agent can prove who it is anywhere, without registering with a platform first." />{" "}
          with{" "}
          <Term term="verifiable credentials" what="A credential (KYC, employment, age) issued by a trusted party, signed cryptographically. The holder can present it later to anyone, and the verifier checks the signature without contacting the issuer." />{" "}
          to establish agent identities and delegations,{" "}
          <Term term="on-chain intent proofs" what="A signed message from the user authorizing a specific action (e.g. 'agent X may swap up to $500 on Aave today'). Stored on-chain so any party can verify the agent isn't acting outside its mandate." />{" "}
          to verify user authorization for transactions, and{" "}
          <Term term="zero-knowledge proofs" what="A proof that a fact is true (e.g. 'this user passed KYC') without revealing the underlying data (their passport, their bank account)." />{" "}
          to preserve privacy while proving policy compliance.{" "}
          <Term term="W3C Verifiable Credentials" what="An open standard (W3C VC) for the cryptographic envelope used to issue, hold, and verify credentials. Same shape across issuers — interoperable." />{" "}
          (&quot;mandates&quot;) provide non-repudiable proof of user consent for agent-driven transactions.
        </p>
        <footer className="mt-3 text-xs text-neutral-500">
          — Arc.network thesis on agentic commerce
        </footer>
      </blockquote>

      <p className="mt-8 max-w-4xl text-lg text-neutral-300">
        That&apos;s an exact description of what MAP ships:{" "}
        <strong className="text-neutral-100">ERC-8004 identity + zkTLS attestations + EIP-712 mandates + on-chain revocation.</strong>{" "}
        We didn&apos;t adapt to Arc — Arc&apos;s thesis IS our product.
      </p>

      {/* Margin table */}
      <div className="mt-10 max-w-5xl overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/70">
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
            <Row cells={["OpenAI key in env", "$0 (until breach)", "—", "days, after Stripe email"]} />
            <Row cells={["Cloudflare AI Gateway", "infra fee", "bearer (still leakable)", "rotate keys in N services"]} />
            <Row
              cells={[
                <strong key="0" className="text-[var(--color-usdc)]">MAP on Arc</strong>,
                <strong key="1" className="text-[var(--color-usdc)]">$0.0005 USDC</strong>,
                <strong key="2" className="text-[var(--color-usdc)]">ERC-8004 + zkTLS</strong>,
                <strong key="3" className="text-[var(--color-usdc)]">one TX (~2s)</strong>,
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
      </p>
    </section>
  );
}

/* ── slide 6: roadmap (LEFT) + creator (RIGHT) ──────────────────────────── */

function Slide6RoadmapCreator() {
  return (
    <section
      id="roadmap"
      className="flex min-h-[100vh] flex-col justify-center border-t border-neutral-900 px-8 py-24 sm:px-16"
    >
      <p className="mb-6 text-xs uppercase tracking-widest text-neutral-500">Roadmap + creator</p>
      <h2 className="max-w-5xl text-5xl font-semibold leading-tight">
        Open source. <span className="text-neutral-500">Solo built.</span>
        <br />
        Years of thesis behind it.
      </h2>

      <div className="mt-12 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ROADMAP — now LEFT */}
        <div>
          <h3 className="mb-3 text-xs uppercase tracking-widest text-[var(--color-usdc)]">
            Roadmap
          </h3>
          <ul className="space-y-3 text-sm text-neutral-300">
            <li>
              <strong>v0.2 — Wallet vault for autonomous agent trading.</strong>{" "}
              Same session-key delegation pattern, applied to wallet operations.
              Agent trades on-chain; private key never leaves MetaMask. Revoke a
              compromised session in one click — your wallet stays untouched.
            </li>
            <li>
              <strong>v0.2 — Sandbox runtime: Phala TEE or{" "}
              <a
                className="underline"
                href="https://github.com/CelestoAI/SmolVM"
                target="_blank"
                rel="noreferrer"
              >
                Celesto SmolVM
              </a>
              .</strong>{" "}
              Agent code runs in a hardware-isolated microVM holding the PK.
              Compromised agent code can&apos;t exfiltrate. MAP gates external API
              calls; the sandbox gates code execution. Defense in depth.
            </li>
            <li>
              <strong>v0.3 — Multi-chain.</strong> Same architecture on Base,
              Solana via Wormhole. Reputation registry per ERC-8004.
            </li>
            <li>
              <strong>v1.0 — Full onboarding wizard + production launch.</strong>{" "}
              SDKs published for OpenClaw, Hermes, LangGraph, Claude Agent SDK,
              AutoGen.
            </li>
          </ul>
        </div>

        {/* CREATOR — now RIGHT */}
        <div>
          <h3 className="mb-3 text-xs uppercase tracking-widest text-[var(--color-usdc)]">
            Creator
          </h3>
          <p className="text-lg text-neutral-200">Calvin Pak</p>
          <p className="mt-1 text-sm text-neutral-400">
            Creator, Molecule Protocol — NFT proof tokens → on-chain SDL
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
            <li className="pt-1">
              • <strong className="text-neutral-300">MAP is open source</strong> — MIT licensed, contributions welcome
            </li>
          </ul>
        </div>
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
        <a
          className="text-[var(--color-usdc)] underline"
          href={DEMO_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open the live dashboard ↗
        </a>{" "}
        ·{" "}
        <a
          className="text-[var(--color-usdc)] underline"
          href="https://github.com/molecule-protocol/molecule-agent-proxy"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </p>
      <p className="mt-4">moleculeprotocol.io · MIT licensed</p>
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
      <div className="text-sm leading-relaxed text-neutral-400">{children}</div>
    </div>
  );
}

function Row({ cells, accent }: { cells: React.ReactNode[]; accent?: boolean }) {
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

/**
 * Inline term with hover/tap explanation. Uses native <abbr> + title for hover
 * tooltip, plus underline-on-dotted styling so it's visibly explainable.
 */
function Term({ term, what }: { term: string; what: string }) {
  return (
    <abbr
      title={what}
      className="cursor-help border-b border-dotted border-neutral-500 text-neutral-200 no-underline hover:border-[var(--color-usdc)]"
    >
      {term}
    </abbr>
  );
}
