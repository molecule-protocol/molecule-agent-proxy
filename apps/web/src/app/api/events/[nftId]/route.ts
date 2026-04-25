// SSE stream of Charged events for one agent NFT, fed by polling Arc on a
// short interval. Polling rather than viem.watchContractEvent because the
// public RPC's WS endpoint is unreliable and polling each ~2-block window
// is plenty fast for a live UI feed.
//
// Reconnect-safe: client sends `?since=<blockNumber>` to resume from a known
// point (combined with browser auto-reconnect on EventSource). Without it,
// stream begins at the current head.
//
// Circuit-broken: after N consecutive RPC errors, the stream closes itself
// rather than spamming error frames forever.

import { type NextRequest } from "next/server";
import { publicClient } from "@/lib/viem";
import { ADDR } from "@/lib/contracts";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { parseAbiItem, formatUnits } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHARGED_EVENT = parseAbiItem(
  "event Charged(uint256 indexed nftId, bytes32 indexed requestNonce, address indexed payer, uint64 fee, uint64 timestamp)",
);

const POLL_MS = 2000;
const MAX_CONSECUTIVE_ERRORS = 5;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nftId: string }> },
) {
  const { nftId: nftIdStr } = await params;
  if (!/^\d+$/.test(nftIdStr)) {
    return Response.json({ error: { code: "INVALID_NFT_ID" } }, { status: 400 });
  }
  const nftId = BigInt(nftIdStr);

  // SSE connection ceiling — prevents browser-tab fan-out from exhausting
  // the Node event loop. Generous because legit dashboard users may have
  // multiple tabs open.
  const rl = await rateLimit(`events:${clientIp(req)}`, { limit: 30, windowSec: 60 });
  if (rl) return rl;

  const sinceParam = req.nextUrl.searchParams.get("since");
  const startedAt = await publicClient.getBlockNumber().catch(() => null);
  if (startedAt === null) {
    return Response.json({ error: { code: "RPC_UNREACHABLE" } }, { status: 503 });
  }
  let lastBlock =
    sinceParam && /^\d+$/.test(sinceParam) && BigInt(sinceParam) > 0n
      ? BigInt(sinceParam)
      : startedAt;

  const stream = new ReadableStream({
    async start(controller) {
      let consecutiveErrors = 0;
      let closed = false;

      const safeEnqueue = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          closed = true;
        }
      };

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {/* noop */}
      };

      safeEnqueue("hello", {
        nftId: nftId.toString(),
        startBlock: lastBlock.toString(),
      });

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const head = await publicClient.getBlockNumber();
          if (head <= lastBlock) {
            consecutiveErrors = 0;
            return;
          }
          const logs = await publicClient.getLogs({
            address: ADDR.moleculeVault,
            event: CHARGED_EVENT,
            args: { nftId },
            fromBlock: lastBlock + 1n,
            toBlock: head,
          });
          for (const log of logs) {
            safeEnqueue("charged", {
              txHash: log.transactionHash,
              blockNumber: Number(log.blockNumber),
              requestNonce: log.args.requestNonce,
              payer: log.args.payer,
              feeUSDC: formatUnits(BigInt(log.args.fee ?? 0n), 6),
              timestamp: Number(log.args.timestamp ?? 0n),
            });
          }
          lastBlock = head;
          consecutiveErrors = 0;
        } catch (e) {
          consecutiveErrors += 1;
          console.error(`[sse:${nftIdStr}] poll error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}:`, e);
          safeEnqueue("error", { code: "POLL_ERROR" });
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            clearInterval(interval);
            safeClose();
          }
        }
      }, POLL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
