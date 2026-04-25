// Per-key token bucket rate limit, backed by the same KV used for nonce/cap.
//
// Use this to defend against:
//   - DoS on /api/proxy and /api/openai-compat (per IP)
//   - bind-attestation gas grief on /api/attestations/bind (per IP)
//   - SSE connection floods on /api/events (per IP — caller enforces)

import { kv } from "./kv";

interface RateConfig {
  /** Max requests in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

/** Returns null if allowed, else a 429 Response. */
export async function rateLimit(
  key: string,
  cfg: RateConfig,
): Promise<Response | null> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / cfg.windowSec)}`;
  const count = await kv().incrby(bucket, 1, cfg.windowSec * 2);
  if (count > cfg.limit) {
    return new Response(
      JSON.stringify({ error: { code: "RATE_LIMITED", message: `>${cfg.limit} requests in ${cfg.windowSec}s` } }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(cfg.windowSec),
        },
      },
    );
  }
  return null;
}

/**
 * Pull a stable client identifier from the request.
 *
 * Only honors X-Forwarded-For when explicitly enabled via TRUST_PROXY=1
 * (set by the deployment when behind Vercel / Tailscale Funnel). Otherwise
 * the header is attacker-controlled and lets a single client rotate the
 * rate-limit key per request, defeating DoS protection.
 *
 * Fallback "unknown" is intentional: better to bucket all unknown-source
 * requests together than to silently bypass the rate limit.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const xreal = req.headers.get("x-real-ip");
    if (xreal) return xreal.trim();
  }
  return "unknown";
}
