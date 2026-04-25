// Constant-time Bearer-token check for routes that aren't behind session-key signing.
//
// Currently used by: openai-compat (the OpenAI-compatible passthrough that holds
// pre-configured MAP credentials server-side) and attestations/bind (which spends
// the relayer wallet on behalf of the caller).

import { createHash, timingSafeEqual } from "node:crypto";

/** Returns null if authorized, else a 401 Response. */
export function requireBearer(req: Request, envVarName: string): Response | null {
  const expected = process.env[envVarName];
  if (!expected) {
    // Fail closed: never accept unauthenticated requests when the secret isn't set.
    return new Response(
      JSON.stringify({ error: { code: "AUTH_NOT_CONFIGURED", message: `set ${envVarName} env var` } }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    return new Response(
      JSON.stringify({ error: { code: "MISSING_BEARER", message: "Authorization: Bearer <token> required" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!constantTimeStringEq(m[1], expected)) {
    return new Response(
      JSON.stringify({ error: { code: "INVALID_BEARER" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}

/**
 * Length-safe constant-time string compare via SHA-256 normalization.
 * Both sides hash to a fixed 32-byte digest, then timing-safe compare. No
 * length leak (Round-2 audit #6); no buffer-size special-casing required.
 */
function constantTimeStringEq(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}
