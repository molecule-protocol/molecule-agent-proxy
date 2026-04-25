// /v1/models — gated behind the same Bearer as chat-completions to keep
// the public URL from being a free model-discovery surface.

import { NextRequest } from "next/server";
import { requireBearer } from "@/lib/auth-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireBearer(req, "OPENAI_COMPAT_BEARER");
  if (auth) return auth;
  return Response.json({
    object: "list",
    data: [
      { id: "openai/gpt-4o-mini", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "openai/gpt-4o", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "anthropic/claude-haiku-4-5", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "anthropic/claude-sonnet-4-6", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "google/gemini-2.5-flash", object: "model", owned_by: "molecule-agent-proxy" },
      { id: "google/gemini-2.5-pro", object: "model", owned_by: "molecule-agent-proxy" },
    ],
  });
}
