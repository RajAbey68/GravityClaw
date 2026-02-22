import os from "node:os";
import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";

  const container = await getAppContainer();
  const agents = container.orchestrator.listAgents(workspaceId);
  const rooms = await container.orchestrator.activeRooms(workspaceId);
  const providers = await container.providers.list();
  const currentProvider = container.providers.getCurrent();
  const providerKeys = container.providers.keyState();
  const usage = await container.events.providerUsageTotals();
  const toolUsage = await container.events.toolUsageCounts(30);
  const memory = await container.memories.usageStats();
  const forgeJobs = await container.forge.listJobs();
  const recentForgeEvents = forgeJobs
    .filter((job) => job.agentId.startsWith(`${workspaceId}:`) || !job.agentId.includes(":"))
    .slice(0, 8);
  const delegations = await container.collaboration.recentDelegations(8);
  const proactiveRules = await container.proactive.listRules();
  const workspaceProactiveRules = proactiveRules.filter((rule) => {
    if (!rule.pattern_json) return workspaceId === "default";
    try {
      const parsed = JSON.parse(rule.pattern_json) as { workspaceId?: string };
      return (parsed.workspaceId ?? "default") === workspaceId;
    } catch {
      return workspaceId === "default";
    }
  });

  const runningLoops = agents.filter((agent) => agent.status === "busy").length;
  const activeSubAgents = agents.filter((agent) => agent.type === "sub-agent");
  const totalCalls = (await container.callCoordinator.listSessions()).length;
  const systemHealth = {
    nodeUptimeSeconds: Math.floor(process.uptime()),
    rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2)),
    heapUsedMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
    loadAvg: os.loadavg().map((value) => Number(value.toFixed(2)))
  };

  return NextResponse.json({
    workspaceId,
    activeAgents: agents.length,
    runningLoops,
    activeSubAgents: activeSubAgents.length,
    rooms: rooms.length,
    currentProvider,
    providerKeys,
    providers,
    usage,
    memory,
    totalCalls,
    systemHealth,
    subAgentTree: agents.map((agent) => ({
      id: agent.id,
      parentId: agent.parentId ?? null,
      status: agent.status
    })),
    recentForgeEvents,
    recentDelegations: delegations,
    proactiveRules: workspaceProactiveRules,
    toolUsage
  });
}
