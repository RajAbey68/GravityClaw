import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

type LogTab = "system" | "agent" | "tool" | "forge" | "delegation" | "audit" | "all";

function toSeverity(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("error") || normalized.includes("failed")) return "error";
  if (normalized.includes("warning") || normalized.includes("blocked")) return "warning";
  return "info";
}

function inDateRange(timestamp: string, from?: string | null, to?: string | null) {
  if (from && new Date(timestamp) < new Date(from)) return false;
  if (to && new Date(timestamp) > new Date(to)) return false;
  return true;
}

function tabForEvent(type: string): LogTab {
  if (type.startsWith("agent.") || type === "group.turn") return "agent";
  if (type.startsWith("tool.")) return "tool";
  if (type.startsWith("forge.")) return "forge";
  if (type.startsWith("delegation.")) return "delegation";
  if (type.startsWith("audit.")) return "audit";
  if (type.startsWith("system.")) return "system";
  return "all";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab")?.trim().toLowerCase() ?? "all") as LogTab;
  const agentFilter = searchParams.get("agent")?.trim().toLowerCase();
  const severityFilter = searchParams.get("severity")?.trim().toLowerCase();
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const limit = Number(searchParams.get("limit") ?? 300);

  const container = await getAppContainer();
  const events = container.eventBus.recent(Number.isFinite(limit) ? limit : 300);
  const audit = await container.auditRepo.listRecent(150);
  const delegations = await container.collaboration.recentDelegations(150);
  const forgeJobs = await container.forgeRepo.listJobs(120);

  const eventLogs = events.map((event) => ({
    tab: tabForEvent(event.type),
    type: event.type,
    timestamp: event.timestamp,
    severity: toSeverity(event.type),
    agent:
      (typeof (event as { agentId?: string }).agentId === "string" && (event as { agentId?: string }).agentId) ||
      (typeof (event as { fromAgentId?: string }).fromAgentId === "string" && (event as { fromAgentId?: string }).fromAgentId) ||
      (typeof (event as { controllingAgentId?: string }).controllingAgentId === "string" &&
        (event as { controllingAgentId?: string }).controllingAgentId) ||
      undefined,
    payload: event
  }));

  const forgeLogs = forgeJobs.map((job) => ({
    tab: "forge" as const,
    type: "forge.job.db",
    timestamp: job.updatedAt,
    severity: job.status === "failed" ? "error" : job.status === "awaiting_approval" ? "warning" : "info",
    agent: job.agentId,
    payload: job
  }));

  const delegationLogs = delegations.map((row) => ({
    tab: "delegation" as const,
    type: "delegation.task",
    timestamp: row.updated_at,
    severity: row.status === "failed" ? "error" : row.status === "running" ? "warning" : "info",
    agent: row.parent_agent_id,
    payload: row
  }));

  const auditLogs = audit.map((row) => ({
    tab: "audit" as const,
    type: "audit.log.db",
    timestamp: row.created_at,
    severity: "info",
    agent: row.actor_id ?? undefined,
    payload: row
  }));

  const logs = [...eventLogs, ...forgeLogs, ...delegationLogs, ...auditLogs]
    .filter((entry) => {
      if (tab !== "all" && entry.tab !== tab) return false;
      if (agentFilter && (!entry.agent || !entry.agent.toLowerCase().includes(agentFilter))) return false;
      if (severityFilter && entry.severity !== severityFilter) return false;
      if (!inDateRange(entry.timestamp, dateFrom, dateTo)) return false;
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, Number.isFinite(limit) ? limit : 300);

  return NextResponse.json({ logs });
}
