# @molecule/map-skill

Universal agent runtime SDK for [Molecule Agent Proxy](https://moleculeprotocol.io).

Identity-gated, key-free API access for any AI agent.

## Install

```bash
npm install @molecule/map-skill
```

## Use — env-var path (recommended)

The simplest setup: configure three env vars on the agent runtime, then let the SDK build the client from them.

```ts
import { setupMapClient, loadCredentialsFromEnv } from "@molecule/map-skill";

const map = setupMapClient(loadCredentialsFromEnv());

const response = await map.chat({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(await response.json());
```

Required env vars:
- `MAP_NFT_ID` — your agent's ERC-8004 NFT id (uint256 string)
- `MAP_SESSION_KEY` — `0x`-prefixed session private key
- `MAP_DELEGATION` — JSON of the EIP-712 signed delegation
- `MAP_PROXY_URL` — defaults to `https://proxy.moleculeprotocol.io`

## Use — explicit credentials

If you build credentials manually (e.g., from a vault / KMS), pass them directly. Note that bigint fields are required — the type definition rejects raw strings to keep on-the-wire and in-memory representations distinct.

```ts
import { setupMapClient } from "@molecule/map-skill";

const map = setupMapClient({
  nftId: 12345n,
  sessionPrivateKey: process.env.MAP_SESSION_KEY as `0x${string}`,
  delegation: {
    message: {
      sessionKey: "0xABC…",
      vault: "0xDEF…",
      scope: ["openrouter:openai/*"],
      capPerDayUSDC: 1_000_000n,    // $1.00 in 6-decimal USDC base units
      expiresAt: 1735689600n,
      nonce: 1n,
    },
    signature: "0x…", // user wallet's EIP-712 signature
  },
  proxyUrl: "https://proxy.moleculeprotocol.io",
});
```

## What you get

That's it. No OpenAI key. Identity-verified per call. Revocable at moleculeprotocol.io.

Each `map.chat({...})` call:
- POSTs to `${proxyUrl}/api/proxy/v1/chat/completions` with MAP signing headers
- Returns a standard `Response` whose body is the upstream LLM's chat completion
- Sets `X-MAP-Charge-Tx` header with the on-chain transaction hash for the call

## License

MIT
