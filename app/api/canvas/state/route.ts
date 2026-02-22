import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const container = await getAppContainer();
  const agents = container.orchestrator.listAgents(workspaceId);
  const rooms = await container.orchestrator.activeRooms(workspaceId);
  const forgeJobs = await container.forge.listJobs();
  const calls = await container.callCoordinator.listSessions();
  const recentDelegations = await container.collaboration.recentDelegations(40);
  const providerTotals = await container.events.providerUsageTotals();
  const toolUsage = await container.events.toolUsageCounts();
  const memoryStats = await container.memories.usageStats();
  const recentEvents = container.eventBus.recent(250);
  const memoryReadEvents = recentEvents.filter((event) => event.type === "memory.read").length;
  const runningLoops = agents.filter((agent) => agent.status === "busy").length;
  const workspaceForge = forgeJobs.filter((job) => job.agentId.startsWith(`${workspaceId}:`) || !job.agentId.includes(":"));
  const roomMessages =
    rooms.length > 0
      ? await container.collaboration.recentRoomMessages(rooms[0].id, 120)
      : [];
  const hierarchy = agents.map((agent) => ({
    id: agent.id,
    parentId: agent.parentId ?? null,
    type: agent.type,
    status: agent.status
  }));

  return NextResponse.json({
    agents,
    hierarchy,
    rooms,
    forgeJobs: workspaceForge.slice(0, 40),
    calls: calls.slice(0, 40),
    delegations: recentDelegations.filter((row) => agents.some((agent) => agent.id === row.parent_agent_id)).slice(0, 30),
    usage: {
      provider: providerTotals,
      toolUsage
    },
    memory: memoryStats,
    runningLoops,
    memoryReadEvents,
    recentEvents: recentEvents.slice(0, 80),
    recentRoomMessages: roomMessages.reverse()
  });
}
