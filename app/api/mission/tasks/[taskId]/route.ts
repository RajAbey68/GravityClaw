import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

type MissionStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type MissionPriority = "low" | "medium" | "high" | "critical";

const statusValues = new Set<MissionStatus>(["inbox", "assigned", "in_progress", "review", "done"]);
const priorityValues = new Set<MissionPriority>(["low", "medium", "high", "critical"]);

function parseArray(input: unknown) {
  if (!Array.isArray(input)) return undefined;
  const values = input.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return values;
}

export async function GET(_request: Request, context: { params: { taskId: string } }) {
  const container = await getAppContainer();
  const task = await container.mission.getTask(context.params.taskId);
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, context: { params: { taskId: string } }) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    status?: MissionStatus;
    priority?: MissionPriority;
    assignedAgentId?: string | null;
    requiredSkills?: unknown;
    tags?: unknown;
    deliverables?: unknown;
  };

  if (body.status && !statusValues.has(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.priority && !priorityValues.has(body.priority)) {
    return NextResponse.json({ error: "invalid priority" }, { status: 400 });
  }

  const container = await getAppContainer();
  const existing = await container.mission.getTask(context.params.taskId);
  if (!existing) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const updated = await container.mission.updateTask(context.params.taskId, {
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    assignedAgentId: body.assignedAgentId,
    requiredSkills: parseArray(body.requiredSkills),
    tags: parseArray(body.tags),
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : undefined
  });

  if (!updated) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  if (body.status && body.status !== existing.status) {
    const eventType = body.status === "in_progress" ? "started" : body.status === "review" ? "reviewed" : body.status === "done" ? "completed" : "status";
    await container.mission.addTaskEvent({
      taskId: context.params.taskId,
      eventType,
      agentId: updated.assigned_agent_id ?? undefined,
      content: `Status changed from ${existing.status} to ${body.status}`
    });
  }

  if (body.assignedAgentId !== undefined && body.assignedAgentId !== existing.assigned_agent_id) {
    await container.mission.addTaskEvent({
      taskId: context.params.taskId,
      eventType: body.assignedAgentId ? "assigned" : "unassigned",
      agentId: body.assignedAgentId ?? undefined,
      content: body.assignedAgentId ? `Assigned to ${body.assignedAgentId}` : "Task unassigned"
    });
  }

  publishEvent(container.eventBus, {
    type: "mission.task",
    action: "updated",
    taskId: updated.id,
    workspaceId: updated.workspace_id,
    status: updated.status,
    assignedAgentId: updated.assigned_agent_id ?? undefined
  });

  container.docs.record({
    source: "mission",
    detail: `Updated mission task '${updated.id}' in workspace '${updated.workspace_id}'.`
  });

  return NextResponse.json({ ok: true, task: updated });
}

export async function DELETE(_request: Request, context: { params: { taskId: string } }) {
  const container = await getAppContainer();
  const existing = await container.mission.getTask(context.params.taskId);
  if (!existing) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const removed = await container.mission.deleteTask(context.params.taskId);
  if (!removed) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  publishEvent(container.eventBus, {
    type: "mission.task",
    action: "deleted",
    taskId: context.params.taskId,
    workspaceId: existing.workspace_id,
    status: existing.status,
    assignedAgentId: existing.assigned_agent_id ?? undefined
  });
  publishEvent(container.eventBus, {
    type: "mission.task.event",
    taskId: context.params.taskId,
    eventType: "deleted",
    workspaceId: existing.workspace_id,
    agentId: existing.assigned_agent_id ?? undefined,
    content: `Task deleted: ${existing.title}`
  });

  container.docs.record({
    source: "mission",
    detail: `Deleted mission task '${context.params.taskId}' from workspace '${existing.workspace_id}'.`
  });

  return NextResponse.json({ ok: true });
}