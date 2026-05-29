import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

// ─── Strangler-fig proxy ────────────────────────────────────────────────────
// When TASKS_SERVICE_URL is set all task requests are forwarded to the
// dedicated tasks microservice. The monolith falls back to its own logic when
// the env var is absent — instant rollback by removing the variable.

async function proxyToTasksService(req: Request, suffix = ""): Promise<Response | null> {
  const base = process.env["TASKS_SERVICE_URL"];
  if (!base) return null;

  const origin = new URL(req.url);
  const target = new URL(`${base.replace(/\/$/, "")}/tasks${suffix}${origin.search}`);

  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
  };
  const internalKey = process.env["INTERNAL_SERVICE_KEY"];
  if (internalKey) headers["x-internal-key"] = internalKey;

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  init.signal = controller.signal;

  try {
    const upstream = await fetch(target.toString(), init);
    clearTimeout(timer);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return new Response(
      JSON.stringify({ error: isTimeout ? "tasks service timed out" : "tasks service unavailable" }),
      {
        status: isTimeout ? 504 : 502,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
// ────────────────────────────────────────────────────────────────────────────

type MissionStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type MissionPriority = "low" | "medium" | "high" | "critical";

const statusValues = new Set<MissionStatus>(["inbox", "assigned", "in_progress", "review", "done"]);
const priorityValues = new Set<MissionPriority>(["low", "medium", "high", "critical"]);

function parseArray(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  const proxied = await proxyToTasksService(request);
  if (proxied) return proxied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId")?.trim() || "default";
  const statusParam = searchParams.get("status")?.trim() as MissionStatus | null;
  const agentId = searchParams.get("agentId")?.trim() || undefined;
  const limitRaw = Number(searchParams.get("limit") ?? "120");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 120;

  if (statusParam && !statusValues.has(statusParam)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const container = await getAppContainer();
  const tasks = await container.mission.listTasks({
    workspaceId,
    status: statusParam ?? undefined,
    agentId,
    limit
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const proxied = await proxyToTasksService(request);
  if (proxied) return proxied;

  const body = (await request.json()) as {
    workspaceId?: string;
    title?: string;
    description?: string;
    status?: MissionStatus;
    priority?: MissionPriority;
    assignedAgentId?: string;
    requiredSkills?: unknown;
    tags?: unknown;
    deliverables?: unknown;
  };

  const workspaceId = body.workspaceId?.trim() || "default";
  const title = body.title?.trim() || "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (body.status && !statusValues.has(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.priority && !priorityValues.has(body.priority)) {
    return NextResponse.json({ error: "invalid priority" }, { status: 400 });
  }

  const container = await getAppContainer();
  const created = await container.mission.createTask({
    workspaceId,
    title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    assignedAgentId: body.assignedAgentId?.trim() || undefined,
    requiredSkills: parseArray(body.requiredSkills),
    tags: parseArray(body.tags),
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : undefined
  });

  if (!created) {
    return NextResponse.json({ error: "failed to create task" }, { status: 500 });
  }

  if (created.assigned_agent_id) {
    await container.mission.addTaskEvent({
      taskId: created.id,
      eventType: "assigned",
      agentId: created.assigned_agent_id,
      content: `Task assigned to ${created.assigned_agent_id}`
    });
  }

  publishEvent(container.eventBus, {
    type: "mission.task",
    action: "created",
    taskId: created.id,
    workspaceId,
    status: created.status,
    assignedAgentId: created.assigned_agent_id ?? undefined
  });
  publishEvent(container.eventBus, {
    type: "mission.task.event",
    taskId: created.id,
    eventType: "created",
    workspaceId,
    agentId: created.assigned_agent_id ?? undefined,
    content: `Task created: ${created.title}`
  });

  container.docs.record({
    source: "mission",
    detail: `Created mission task '${created.id}' in workspace '${workspaceId}'.`
  });

  return NextResponse.json({ ok: true, task: created });
}