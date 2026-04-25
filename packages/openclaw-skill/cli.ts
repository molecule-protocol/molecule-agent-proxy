#!/usr/bin/env node
//
// MAP CLI — single-file invocation of an LLM via Molecule Agent Proxy.
//
// OpenClaw (or any agent runtime) drops this CLI into a skill directory and
// invokes it instead of holding LLM API keys directly. Each call is identity-
// verified on Arc, paid in nano-USDC, and audited on-chain.
//
// Usage:
//   node map-cli.js --model openai/gpt-4o-mini --prompt "Hello"
//   echo "Hello" | node map-cli.js --model openai/gpt-4o-mini --stdin
//
// Requires env:
//   MAP_NFT_ID            agent's ERC-8004 NFT id (uint256 string)
//   MAP_SESSION_KEY       0x-prefixed 32-byte session private key
//   MAP_DELEGATION        JSON of EIP-712 signed delegation
//   MAP_PROXY_URL         optional, defaults to https://proxy.moleculeprotocol.io

import { setupMapClient, loadCredentialsFromEnv } from "@molecule/map-skill";

interface Args {
  model: string;
  prompt: string | null;
  stdin: boolean;
  maxTokens: number;
  raw: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { model: "openai/gpt-4o-mini", prompt: null, stdin: false, maxTokens: 256, raw: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--model") out.model = argv[++i];
    else if (a === "--prompt") out.prompt = argv[++i];
    else if (a === "--stdin") out.stdin = true;
    else if (a === "--max-tokens") out.maxTokens = parseInt(argv[++i], 10);
    else if (a === "--raw") out.raw = true;
    else if (a === "--help" || a === "-h") {
      console.log(`usage: map-cli --model <m> [--prompt "..." | --stdin] [--max-tokens N] [--raw]`);
      process.exit(0);
    }
  }
  return out;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = args.prompt ?? (args.stdin ? await readStdin() : null);
  if (!prompt) {
    console.error("error: provide --prompt or --stdin");
    process.exit(1);
  }

  let creds;
  try {
    creds = loadCredentialsFromEnv();
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    console.error(`hint: export MAP_NFT_ID, MAP_SESSION_KEY, MAP_DELEGATION`);
    process.exit(1);
  }

  const map = setupMapClient(creds);
  const t0 = Date.now();
  const res = await map.chat({
    model: args.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: args.maxTokens,
  });
  const elapsed = Date.now() - t0;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: unknown;
  };

  const chargeTx = res.headers.get("x-map-charge-tx");
  if (res.status !== 200) {
    console.error(`MAP ${res.status}:`, JSON.stringify(data));
    process.exit(1);
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  if (args.raw) {
    process.stdout.write(JSON.stringify(data));
  } else {
    process.stdout.write(content);
  }
  process.stderr.write(`\n[map] ${elapsed}ms · charge=${chargeTx?.slice(0, 14)}…\n`);
}

main().catch((e) => { console.error(`map-cli fatal: ${e}`); process.exit(1); });
