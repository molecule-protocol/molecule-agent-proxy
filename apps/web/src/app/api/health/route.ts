import { publicClient } from "@/lib/viem";
import { ADDR } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const block = await publicClient.getBlockNumber();
    return Response.json({
      ok: true,
      chainId: publicClient.chain?.id,
      block: block.toString(),
      contracts: ADDR,
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
