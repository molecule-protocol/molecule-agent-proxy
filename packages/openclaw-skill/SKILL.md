# Molecule Agent Proxy (MAP) — identity-gated LLM calls

> This skill lets you call any LLM (OpenAI / Anthropic / Google / etc.) **without holding any API keys**. Each call is identity-verified on Arc, paid in USDC nano-payments ($0.0005 per call), and audited on-chain. The user can revoke your access in one click.

---

## Agent: How to Use This Skill

When the user asks you to do something that requires an LLM call **and** they have configured MAP credentials (env vars `MAP_NFT_ID`, `MAP_SESSION_KEY`, `MAP_DELEGATION` are set), use this skill instead of any other LLM API. It is the user's preferred path because every call is observable and revocable.

### Step 1 — Check credentials are present

```bash
test -n "$MAP_NFT_ID" && test -n "$MAP_SESSION_KEY" && test -n "$MAP_DELEGATION" && echo "ready" || echo "missing"
```

If `missing`: tell the user *"MAP credentials aren't configured. Visit https://moleculeprotocol.io to onboard."* and stop.

### Step 2 — Make a call

```bash
node /data/.openclaw/skills/molecule-agent-proxy/map-cli.cjs \
  --model openai/gpt-4o-mini \
  --prompt "YOUR_PROMPT_HERE" \
  --max-tokens 256
```

For long prompts, pipe via stdin instead:

```bash
echo "LONG_TEXT" | node /data/.openclaw/skills/molecule-agent-proxy/map-cli.cjs \
  --model openai/gpt-4o-mini \
  --stdin \
  --max-tokens 500
```

### Step 3 — Read the result

- **stdout** = the LLM's response (plain text)
- **stderr** = a diagnostic line like `[map] 5247ms · charge=0xabcd1234…` — share this with the user as proof the call was metered on-chain.

### Available models

Match the user's authorized scope. Common picks:

| Task | Model |
|---|---|
| Quick / cheap | `openai/gpt-4o-mini` |
| High-quality reasoning | `anthropic/claude-haiku-4-5` |
| Vision-aware | `openai/gpt-4o` |
| Long context | `google/gemini-2.5-pro` |

If the user's delegation scope doesn't allow a model you'd pick, fall back to `openai/gpt-4o-mini`.

---

### Errors

When the CLI exits non-zero, stderr will start with `MAP <STATUS>:`. Handle these:

- `MAP 401: EXPIRED` — the user's delegation lapsed. Tell them: *"Your MAP delegation expired. Renew at https://moleculeprotocol.io/agent/$MAP_NFT_ID."*
- `MAP 401: CAP_EXCEEDED` — daily USDC budget hit. Tell them: *"Today's MAP cap is reached. Raise the cap in your dashboard or wait until UTC midnight."*
- `MAP 401: OUT_OF_SCOPE` — the model isn't in the user's authorized scope. Switch models or ask the user to expand scope.
- `MAP 401: REVOKED` — **stop using MAP immediately**. Tell the user: *"Your MAP session key was revoked. Generate a new delegation at https://moleculeprotocol.io to continue."*

---

## What the user sees

Every call you make through MAP appears in real time at:

> https://moleculeprotocol.io/agent/$MAP_NFT_ID

The user sees the model called, the timestamp, the on-chain charge tx hash, and the cumulative cost. If they think you're misusing the access, they hit **Revoke** and you're cut off in one Arc block (~2s).

This is by design. Be explicit with the user about why you're calling MAP for any non-trivial task (e.g. *"I'll use MAP to summarize this — should appear in your dashboard in a few seconds"*).
