// Demo-only attestation bind. Lets the dashboard's "Bind KYC/Company"
// button work without exposing the BIND_BEARER. Safe because:
//   - Hardcoded to NFT #5 (the demo agent — no other agent's hash list pollutable)
//   - Tight per-IP rate limit (5/hour)
//   - Subject must be the demo NFT's owner address
//
// Production replacement: per-user bearer via SIWE session, or signed
// request from the user's wallet.

import { NextRequest } from "next/server";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import { publicClient, relayerWallet } from "@/lib/viem";
import { ADDR, ABI } from "@/lib/contracts";
import { ISSUER_BUILDERS, ADDRESS_REGEX, type IssuerType } from "@/lib/issuers";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorMap } from "@/lib/error-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_NFT_ID = "5";
const DEMO_OWNER = "0x7483DDe29C04C6f3B53c847d13445748854b04cD".toLowerCase();

interface BindBody {
  nftId?: string;
  issuerType?: IssuerType;
  subject?: string;
}

export async function POST(req: NextRequest) {
  // Tight rate limit — 5/hour per IP. This bind costs ~$0.01 of relayer gas;
  // 5/hour caps grief at $0.05/hr/IP, $1.20/day. Acceptable.
  const rl = await rateLimit(`bind-demo:${clientIp(req)}`, { limit: 5, windowSec: 3600 });
  if (rl) return rl;

  let body: BindBody;
  try {
    body = await req.json();
  } catch {
    return errorMap("INVALID_JSON", 400);
  }

  const { nftId, issuerType, subject } = body;
  if (!nftId || !issuerType || !subject) {
    return errorMap("MISSING_FIELDS", 400);
  }

  // Demo guards: must be the demo NFT + the demo owner
  if (nftId !== DEMO_NFT_ID) {
    return errorMap("DEMO_NFT_ONLY", 400, `this endpoint only binds to NFT #${DEMO_NFT_ID}`);
  }
  if (subject.toLowerCase() !== DEMO_OWNER) {
    return errorMap("DEMO_SUBJECT_ONLY", 400, "subject must be the demo owner address");
  }
  if (!(issuerType in ISSUER_BUILDERS)) {
    return errorMap("UNKNOWN_ISSUER_TYPE", 400);
  }
  if (!ADDRESS_REGEX.test(subject)) {
    return errorMap("INVALID_SUBJECT", 400);
  }

  const issuerDoc = ISSUER_BUILDERS[issuerType](subject as `0x${string}`);
  const attestationHash = keccak256(
    toBytes(`${issuerDoc.issuer.did}|${JSON.stringify(issuerDoc.claim)}|${subject}`),
  );

  const wallet = relayerWallet();
  const data = encodeFunctionData({
    abi: ABI.ValidationRegistry,
    functionName: "record",
    args: [BigInt(nftId), attestationHash],
  });
  let txHash: `0x${string}`;
  try {
    txHash = await wallet.sendTransaction({
      to: ADDR.validationRegistry,
      data,
      account: wallet.account!,
      chain: wallet.chain!,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
  } catch (e) {
    return errorMap("BIND_FAILED", 502, e);
  }

  return Response.json({
    ok: true,
    nftId,
    issuerType,
    subject,
    attestationHash,
    txHash,
    issuer: issuerDoc.issuer,
    claim: issuerDoc.claim,
  });
}
