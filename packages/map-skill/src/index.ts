// @molecule/map-skill — universal agent runtime SDK for Molecule Agent Proxy.
//
// Drop-in replacement for direct OpenAI/Anthropic/OpenRouter clients. Routes all
// calls through MAP, paid per-call in USDC on Arc, signed by a scoped session key.

import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface DelegationMessage {
  sessionKey: `0x${string}`;
  vault: `0x${string}`;
  scope: readonly string[];
  capPerDayUSDC: bigint;
  expiresAt: bigint;
  nonce: bigint;
}

export interface SignedDelegation {
  message: DelegationMessage;
  signature: `0x${string}`;
}

export interface MapCredentials {
  /** ERC-8004 NFT id of the agent. */
  nftId: bigint;
  /** Session keypair private key. */
  sessionPrivateKey: `0x${string}`;
  /** EIP-712 signed delegation. */
  delegation: SignedDelegation;
  /** MAP proxy base URL. Defaults to production. */
  proxyUrl?: string;
}

export interface MapClient {
  /** Drop-in fetch replacement: any URL pointing at the proxy gets MAP-signed. */
  fetch: typeof fetch;
  /** Convenience: chat completions in one call. */
  chat: (body: ChatBody) => Promise<Response>;
}

export interface ChatBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  [key: string]: unknown;
}

const DEFAULT_PROXY = "https://proxy.moleculeprotocol.io";
const CHAT_PATH = "/api/proxy/v1/chat/completions";

export function setupMapClient(creds: MapCredentials): MapClient {
  const sessionAccount = privateKeyToAccount(creds.sessionPrivateKey);
  const proxyUrl = creds.proxyUrl ?? DEFAULT_PROXY;

  const signedFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body == null ? "" : typeof init.body === "string" ? init.body : await new Response(init.body).text();

    const requestNonce = ("0x" + bytesToHex(getRandomBytes(32))) as `0x${string}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = keccak256(toBytes(`${body}|${requestNonce}|${timestamp}`));
    const sessionSig = await sessionAccount.signMessage({ message: { raw: digest } });

    const delegationPacket = {
      message: {
        sessionKey: creds.delegation.message.sessionKey,
        vault: creds.delegation.message.vault,
        scope: creds.delegation.message.scope,
        capPerDayUSDC: creds.delegation.message.capPerDayUSDC.toString(),
        expiresAt: creds.delegation.message.expiresAt.toString(),
        nonce: creds.delegation.message.nonce.toString(),
      },
      signature: creds.delegation.signature,
    };
    const delegationB64 = base64Encode(JSON.stringify(delegationPacket));

    const headers = new Headers(init?.headers);
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
    headers.set("X-MAP-Delegation", delegationB64);
    headers.set("X-MAP-Session-Sig", sessionSig);
    headers.set("X-MAP-Nonce", requestNonce);
    headers.set("X-MAP-Timestamp", String(timestamp));
    headers.set("X-MAP-NFT-Id", creds.nftId.toString());

    return fetch(url, { ...init, method, headers, body: body || undefined });
  };

  return {
    fetch: signedFetch,
    chat: (body: ChatBody) =>
      signedFetch(`${proxyUrl}${CHAT_PATH}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
}

/** Helper: load credentials from env vars (the convention OpenClaw / Hermes / etc. use). */
export function loadCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): MapCredentials {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`@molecule/map-skill: missing env ${k}`);
    return v;
  };
  const nftId = BigInt(need("MAP_NFT_ID"));
  const sessionPrivateKey = need("MAP_SESSION_KEY") as `0x${string}`;
  const delegationJson = need("MAP_DELEGATION");
  const parsed = JSON.parse(delegationJson);
  const delegation: SignedDelegation = {
    message: {
      sessionKey: parsed.message.sessionKey,
      vault: parsed.message.vault,
      scope: parsed.message.scope,
      capPerDayUSDC: BigInt(parsed.message.capPerDayUSDC),
      expiresAt: BigInt(parsed.message.expiresAt),
      nonce: BigInt(parsed.message.nonce),
    },
    signature: parsed.signature,
  };
  return {
    nftId,
    sessionPrivateKey,
    delegation,
    proxyUrl: env.MAP_PROXY_URL ?? DEFAULT_PROXY,
  };
}

// --- portable helpers (Node 20+ baseline; both Node and browser have crypto) ---

function getRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // WebCrypto is the baseline in Node 20+ and all modern browsers.
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("@molecule/map-skill: globalThis.crypto.getRandomValues is required (Node 20+ or modern browser)");
  }
  globalThis.crypto.getRandomValues(out);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function base64Encode(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  // Browser fallback
  if (typeof btoa !== "undefined") {
    return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  }
  throw new Error("@molecule/map-skill: no base64 encoder available");
}

export const PROXY_URL = DEFAULT_PROXY;
