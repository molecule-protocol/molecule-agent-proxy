// Self-owned KYC issuer endpoint — public on purpose. Returns a JSON document
// that Reclaim Protocol's attestor network witnesses over TLS. The browser SDK
// wraps the attestor signature in a ZK proof revealing only the attested claim.
//
// The attestation hash that lands in our ValidationRegistry is computed from
// the same builder used by /api/attestations/bind, ensuring both code paths
// agree on the canonical bytes.

import { NextRequest } from "next/server";
import { buildKYC, ADDRESS_REGEX } from "@/lib/issuers";
import { errorMap } from "@/lib/error-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject");
  if (!subject || !ADDRESS_REGEX.test(subject)) {
    return errorMap("INVALID_SUBJECT", 400, "subject must be 0x... 40-hex-char address");
  }
  return Response.json(buildKYC(subject as `0x${string}`));
}
