// Self-owned company-binding issuer endpoint — same shape as /api/issuers/kyc.
// See @/lib/issuers for the canonical claim builder shared with the bind route.

import { NextRequest } from "next/server";
import { buildCompany, ADDRESS_REGEX } from "@/lib/issuers";
import { errorMap } from "@/lib/error-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject");
  if (!subject || !ADDRESS_REGEX.test(subject)) {
    return errorMap("INVALID_SUBJECT", 400, "subject must be 0x... 40-hex-char address");
  }
  return Response.json(buildCompany(subject as `0x${string}`));
}
