import AgentClient from "./agent-client";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ nftId: string }>;
  searchParams: Promise<{ sessionKey?: string }>;
}) {
  const { nftId } = await params;
  const { sessionKey } = await searchParams;
  return <AgentClient nftId={nftId} sessionKey={sessionKey ?? null} />;
}
