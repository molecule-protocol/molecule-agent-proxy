// Standardized error responses across all routes.
//
// Two shapes:
//   - errorMap()    : `{error: {code, message}}` for MAP-native routes (proxy, attestations, agent, events)
//   - errorOpenAI() : `{error: {message, type, code?}}` for OpenAI-compatible routes (openai-compat)
//
// Both swallow internal details (RPC URLs, encoded calldata, signatures, env values) — the response
// body never includes raw error strings. Internal details go to console.error so the operator can
// triage. Callers get a stable code they can branch on.

const isProd = process.env.NODE_ENV === "production";

export function errorMap(code: string, status: number, internal?: unknown, hint?: string): Response {
  if (internal !== undefined) {
    console.error(`[map-error] ${code}: ${internalToString(internal)}`);
  }
  const body: Record<string, unknown> = { error: { code } };
  if (hint) (body.error as Record<string, unknown>).message = hint;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorOpenAI(message: string, type: string, status: number, internal?: unknown): Response {
  if (internal !== undefined) {
    console.error(`[openai-compat-error] ${type}: ${internalToString(internal)}`);
  }
  return new Response(JSON.stringify({ error: { message, type } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function internalToString(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}` + (isProd ? "" : `\n${e.stack ?? ""}`);
  return String(e);
}
