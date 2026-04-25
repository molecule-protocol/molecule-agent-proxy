---
name: molecule-agent-proxy
description: Identity-gated API access via Molecule Agent Proxy (MAP). Agent calls upstream LLMs through MAP; API keys never leave the user's control.
requires: []
env:
  MAP_NFT_ID: "Identity NFT id from moleculeprotocol.io dashboard"
  MAP_SESSION_KEY: "Session keypair private key (0x...)"
  MAP_DELEGATION: "EIP-712 signed delegation bundle (JSON)"
install: |
  Configure MAP credentials at https://moleculeprotocol.io.
  Set the env vars above in your agent runtime, then import @molecule/map-skill.
---

# Molecule Agent Proxy (MAP) Skill

You are running through MAP. Every external API call is automatically:

- **Identity-verified** on Arc against an ERC-8004 NFT
- **Charged** a $0.0005 USDC nano-payment per call
- **Audited** on-chain (every call emits a `Charged` event)
- **Revocable** by the user in one click — no "rotate the key" panic

You do **not** need to handle API keys. Calls to OpenAI / Anthropic / OpenRouter
work transparently — MAP injects the upstream key from the user's encrypted vault.

## If you hit an error

- `"delegation expired"` — the user's session has timed out. Surface this; they need to re-authorize at moleculeprotocol.io.
- `"cap exceeded"` — daily USDC budget for this session reached. Surface this; user must raise the cap or wait until UTC midnight.
- `"out of scope"` — you're trying to reach a service the delegation doesn't cover. Surface this; user must add the service to scope.
- `"revoked"` — user revoked this session key. Stop making calls; obtain new credentials.

## Universal — works in any runtime

OpenClaw, Hermes, LangGraph, Claude Skills, custom agents — same npm package.
