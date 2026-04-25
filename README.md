# Molecule Agent Proxy (MAP)

**Identity-gated, key-free API access for AI agents. Per-call nano-payments in USDC on Arc.**

Built for the [Agentic Economy on Arc](https://lablab.ai/ai-hackathons/nano-payments-arc) hackathon.

> Track: **Per-API Monetization Engine**
> Stack: ERC-8004 + Reclaim Protocol (zkTLS) + Circle Arc (USDC L1)

---

## What it is

Agents call OpenAI, Anthropic, anything — without ever holding a key.

1. User connects MetaMask, mints an [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) Identity NFT, binds attestations via zkTLS, signs a scoped session-key delegation.
2. Agent uses the session key to sign requests to MAP.
3. MAP verifies signature + delegation + scope + cap on every call, charges $0.0005 USDC nano-payment on Arc, forwards the request to OpenRouter using the user's encrypted API key.
4. If the session key leaks, the user revokes it on-chain. Captured calls can't be replayed (single-use nonces).

## Live demo

| | |
|---|---|
| Dashboard | https://helsinki1.tail7cff3c.ts.net/agent/5?sessionKey=0x070a864B45D3244eF8e68F91cAeBa3a0663D1225 |
| Arc explorer | https://testnet.arcscan.app/address/0xE0f82720D7e3Dd443F4224e2d99Cb38a20E43d74 |
| MoleculeVault | `0xE0f82720D7e3Dd443F4224e2d99Cb38a20E43d74` |
| IdentityRegistry | `0xEb26bd192b2BC95E6308642D337B93A75f45604C` |
| ValidationRegistry | `0xD5623A7AA6ED03928f7Def27A06e8F6E2989F274` |
| RevocationRegistry | `0x14066b12922183254FA5f3d3c43F2a7421EEB2f6` |

## Quickstart

```bash
pnpm install

# 1. Smart contracts (Foundry)
cd packages/contracts
cp .env.example .env   # then fill in DEPLOYER_PRIVATE_KEY + USDC_ADDRESS
forge build
forge test             # 15/15 should pass
# To deploy fresh contracts to Arc testnet:
#   forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast

# 2. Web app (Next.js — proxy + dashboard)
cd ../../apps/web
cp .env.example .env.local   # then fill in real secrets
pnpm dev                     # http://localhost:3010

# 3. End-to-end smoke test
cd ../..
pnpm tsx scripts/setup-demo-credentials.ts   # mints NFT, binds session, signs delegation
pnpm tsx scripts/test-proxy-e2e.ts           # signs + sends a real call through the proxy
```

## Repo layout

```
apps/web/                 Next.js dashboard + proxy API (Vercel-ready)
packages/contracts/       Foundry — IdentityRegistry, ValidationRegistry, RevocationRegistry, MoleculeVault
packages/map-skill/       @molecule/map-skill — universal agent runtime SDK
packages/openclaw-skill/  Bundled CLI for OpenClaw container integration
scripts/                  Setup, demo loop, attacker simulation, e2e tests
deployments/              Per-network contract addresses (arc-testnet.json)
```

## Networks

| Network | Chain ID | RPC | Explorer | Faucet |
|---|---|---|---|---|
| Arc Testnet | 5042002 | https://rpc.testnet.arc.network | https://testnet.arcscan.app | https://faucet.circle.com |

Native gas is USDC. The ERC-20 interface uses 6 decimals; the native gas token uses 18.

## Architecture

- **Smart contracts**: ERC-8004-compatible Identity + Validation registries (NFT per agent, attestation hash per binding) + custom MoleculeVault (per-call USDC charge) + RevocationRegistry (session-key bind + revoke).
- **Session-key delegation**: user's primary wallet signs ONE EIP-712 delegation (off-chain, no TX) declaring `{sessionKey, scope, capPerDayUSDC, expiresAt, nonce}`. The agent uses the session keypair for all subsequent calls. EIP-7702-compatible pattern.
- **Per-call signing**: agent signs `keccak256(body || nonce || timestamp)` with the session key. MAP verifies signature + delegation + scope/cap/expiry/revocation in one round-trip.
- **Charge**: MAP submits `MoleculeVault.chargeAndForward(nftId, requestNonce)` on Arc — emits a `Charged` event the dashboard streams via SSE.
- **Forward**: MAP forwards the request to OpenRouter (or any upstream LLM) using the user's encrypted API key (KMS-wrapped in production; AES-256-GCM in this hackathon build).

## License

MIT.
