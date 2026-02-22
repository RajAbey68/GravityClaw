import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

export async function POST(request: Request, context: { params: { taskId: string } }) {
  const body = (await request.json().catch(() => ({}))) as { reviewerId?: string; note?: string };
  const reviewerId = body.reviewerId?.trim() || "local-ui";
  const note = body.note?.trim() || "Task approved";

  const container = await getAppContainer();
  const existing = await container.mission.getTask(context.params.taskId);
  if (!existing) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const updated = await container.mission.updateTask(context.params.taskId, {
    status: "done"
  });

  if (!updated) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  await container.mission.addTaskEvent({
    taskId: context.params.taskId,
    eventType: "approved",
    agentId: updated.assigned_agent_id ?? undefined,
    content: `${note} by ${reviewerId}`
  });

  publishEvent(container.eventBus, {
    type: "mission.task",
    action: "approved",
    taskId: updated.id,
    workspaceId: updated.workspace_id,
    status: updated.status,
    assignedAgentId: updated.assigned_agent_id ?? undefined
  });
  publishEvent(container.eventBus, {
    type: "mission.task.event",
    taskId: updated.id,
    eventType: "approved",
    workspaceId: updated.workspace_id,
    agentId: updated.assigned_agent_id ?? undefined,
    content: note
  });

  container.docs.record({
    source: "mission",
    detail: `Approved mission task '${updated.id}' in workspace '${updated.workspace_id}'.`
  });

  return NextResponse.json({ ok: true, task: updated });
}