// Initial agent state for the dashboard. Read on-chain.
//
// All RPC calls that don't depend on each other are parallelized to keep the
// 5s dashboard refresh cycle responsive even when the public RPC is slow.

import { type NextRequest } from "next/server";
import { publicClient } from "@/lib/viem";
import { ADDR, ABI } from "@/lib/contracts";
import { errorMap } from "@/lib/error-response";
import { parseAbiItem } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHARGED_EVENT = parseAbiItem(
  "event Charged(uint256 indexed nftId, bytes32 indexed requestNonce, address indexed payer, uint64 fee, uint64 timestamp)",
);

const BOUND_EVENT = parseAbiItem(
  "event Bound(address indexed sessionKey, uint256 indexed nftId, address indexed owner)",
);

const ATTESTATION_RECORDED_EVENT = parseAbiItem(
  "event AttestationRecorded(uint256 indexed nftId, bytes32 indexed attestationHash, address indexed validator, uint64 recordedAt)",
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nftId: string }> },
) {
  const { nftId: nftIdStr } = await params;
  if (!/^\d+$/.test(nftIdStr)) {
    return errorMap("INVALID_NFT_ID", 400);
  }
  const nftId = BigInt(nftIdStr);
  const sessionKeyParam = req.nextUrl.searchParams.get("sessionKey");
  if (sessionKeyParam && !/^0x[a-fA-F0-9]{40}$/.test(sessionKeyParam)) {
    return errorMap("INVALID_SESSION_KEY", 400);
  }

  // Parallel: NFT owner + URI + latest block (independent reads)
  let owner: `0x${string}`;
  let tokenURI: string;
  let latest: bigint;
  try {
    [owner, tokenURI, latest] = await Promise.all([
      publicClient.readContract({
        address: ADDR.identityRegistry,
        abi: ABI.IdentityRegistry,
        functionName: "ownerOf",
        args: [nftId],
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address: ADDR.identityRegistry,
        abi: ABI.IdentityRegistry,
        functionName: "tokenURI",
        args: [nftId],
      }) as Promise<string>,
      publicClient.getBlockNumber(),
    ]);
  } catch (e) {
    return errorMap("NFT_NOT_FOUND", 404, e);
  }

  // Arc public RPC caps eth_getLogs at 10k blocks; 5k is safely under (~2.7h history).
  const fromBlock = latest > 5_000n ? latest - 5_000n : 0n;

  // Parallel: 3 getLogs + optional revocation read
  const [chargedLogs, boundLogs, attestationLogs, revokedAt] = await Promise.all([
    publicClient.getLogs({
      address: ADDR.moleculeVault,
      event: CHARGED_EVENT,
      args: { nftId },
      fromBlock,
      toBlock: latest,
    }),
    publicClient.getLogs({
      address: ADDR.revocationRegistry,
      event: BOUND_EVENT,
      args: { nftId },
      fromBlock,
      toBlock: latest,
    }),
    publicClient.getLogs({
      address: ADDR.validationRegistry,
      event: ATTESTATION_RECORDED_EVENT,
      args: { nftId },
      fromBlock,
      toBlock: latest,
    }),
    sessionKeyParam
      ? (publicClient.readContract({
          address: ADDR.revocationRegistry,
          abi: ABI.RevocationRegistry,
          functionName: "getRevokedAt",
          args: [sessionKeyParam as `0x${string}`],
        }) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);

  const callCount = chargedLogs.length;
  const totalFees = chargedLogs.reduce((s, l) => s + Number(l.args.fee ?? 0n), 0);

  const sessionKeys = boundLogs.map((l) => ({
    sessionKey: l.args.sessionKey!,
    owner: l.args.owner!,
    boundAt: Number(l.blockNumber),
  }));

  const attestations = attestationLogs.map((l) => ({
    attestationHash: l.args.attestationHash!,
    validator: l.args.validator!,
    blockNumber: Number(l.blockNumber),
    txHash: l.transactionHash,
    recordedAt: Number(l.args.recordedAt ?? 0n),
  }));

  const focusedSession = sessionKeyParam
    ? {
        sessionKey: sessionKeyParam as `0x${string}`,
        revokedAt: Number(revokedAt),
        isRevoked: revokedAt > 0n,
      }
    : null;

  return Response.json({
    nftId: nftId.toString(),
    owner,
    tokenURI,
    callCount,
    totalFees,
    sessionKeys,
    focusedSession,
    attestations,
    latestBlock: latest.toString(),
    contracts: {
      identityRegistry: ADDR.identityRegistry,
      moleculeVault: ADDR.moleculeVault,
      revocationRegistry: ADDR.revocationRegistry,
      validationRegistry: ADDR.validationRegistry,
    },
    explorerBase: process.env.ARC_EXPLORER_BASE ?? "https://testnet.arcscan.app",
  });
}
