import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import crypto from "node:crypto";
import type { ProviderId } from "@/src/core/providers/types";

export async function GET(request: Request, context: { params: { agentId: string } }) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const container = await getAppContainer();
  const agent = container.lifecycle.get(context.params.agentId, workspaceId);
  if (!agent) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }
  const latestStep = await container.events.latestStepForAgent(workspaceId, agent.id);
  const memoryNamespace = `workspace:${workspaceId}:${agent.isolateLongTermMemory ? agent.id : "main"}`;
  return NextResponse.json({
    agent,
    runtime: {
      currentStep: latestStep?.phase ?? "idle",
      iteration: latestStep?.iteration ?? 0,
      stepDetail: latestStep?.detail ?? "",
      memoryNamespace
    }
  });
}

export async function PATCH(request: Request, context: { params: { agentId: string } }) {
  const body = (await request.json()) as {
    workspaceId?: string;
    label?: string;
    status?: "active" | "idle" | "busy" | "paused" | "error";
    systemPromptOverride?: string;
    soulOverride?: string;
    provider?: ProviderId;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    autonomousSpawning?: boolean;
    isolateShortTermMemory?: boolean;
    isolateLongTermMemory?: boolean;
    isolateTools?: boolean;
    enabledTools?: string[];
    enabledSkills?: string[];
  };

  const workspaceId = body.workspaceId ?? "default";
  const container = await getAppContainer();

  if (
    body.temperature !== undefined &&
    (typeof body.temperature !== "number" || body.temperature < 0 || body.temperature > 2)
  ) {
    return NextResponse.json({ error: "temperature must be between 0 and 2" }, { status: 400 });
  }
  if (
    body.maxTokens !== undefined &&
    (typeof body.maxTokens !== "number" || body.maxTokens < 64 || body.maxTokens > 32000)
  ) {
    return NextResponse.json({ error: "maxTokens must be between 64 and 32000" }, { status: 400 });
  }

  const updated = await container.lifecycle.updateAgent(context.params.agentId, workspaceId, {
    label: body.label,
    status: body.status,
    systemPromptOverride: body.systemPromptOverride,
    soulOverride: body.soulOverride,
    provider: body.provider,
    model: body.model,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    autonomousSpawning: body.autonomousSpawning,
    isolateShortTermMemory: body.isolateShortTermMemory,
    isolateLongTermMemory: body.isolateLongTermMemory,
    isolateTools: body.isolateTools,
    enabledTools: body.enabledTools,
    enabledSkills: body.enabledSkills
  });

  if (!updated) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  container.docs.record({
    source: "agents",
    detail: `Updated agent '${context.params.agentId}' configuration in workspace '${workspaceId}'.`
  });
  publishEvent(container.eventBus, {
    type: "agent.status.changed",
    agentId: updated.id,
    status: updated.status,
    parentId: updated.parentId,
    workspaceId
  });
  const prevHash = await container.auditRepo.latestHash();
  const currHash = crypto
    .createHash("sha256")
    .update(`${prevHash ?? ""}|agent.updated|${workspaceId}|${updated.id}|${new Date().toISOString()}`)
    .digest("hex");
  await container.auditRepo.addLog({
    action: "agent.updated",
    actorType: "user",
    actorId: "local-ui",
    targetPath: "agents.registry",
    diffPath: "state:agent-update",
    summary: `Updated agent '${updated.id}' in workspace '${workspaceId}'.`,
    prevHash,
    currHash
  });

  return NextResponse.json({ ok: true, agent: updated });
}

export async function DELETE(request: Request, context: { params: { agentId: string } }) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const container = await getAppContainer();
  const existing = container.lifecycle.get(context.params.agentId, workspaceId);
  if (!existing) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  try {
    const removed = await container.lifecycle.removeAgent(context.params.agentId, workspaceId);
    if (!removed) {
      return NextResponse.json({ error: "agent not found" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }

  publishEvent(container.eventBus, {
    type: "agent.status.changed",
    agentId: context.params.agentId,
    status: "deleted",
    parentId: existing.parentId,
    workspaceId
  });
  const prevHash = await container.auditRepo.latestHash();
  const currHash = crypto
    .createHash("sha256")
    .update(`${prevHash ?? ""}|agent.deleted|${workspaceId}|${context.params.agentId}|${new Date().toISOString()}`)
    .digest("hex");
  await container.auditRepo.addLog({
    action: "agent.deleted",
    actorType: "user",
    actorId: "local-ui",
    targetPath: "agents.registry",
    diffPath: "state:agent-delete",
    summary: `Deleted agent '${context.params.agentId}' in workspace '${workspaceId}'.`,
    prevHash,
    currHash
  });
  container.docs.record({
    source: "agents",
    detail: `Deleted agent '${context.params.agentId}' from workspace '${workspaceId}'.`
  });

  return NextResponse.json({ ok: true });
}
