import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import crypto from "node:crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const includeAll = searchParams.get("all") === "1";
  const container = await getAppContainer();
  return NextResponse.json({
    agents: includeAll ? container.orchestrator.listAllAgents() : container.orchestrator.listAgents(workspaceId)
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    label?: string;
    parentId?: string;
    workspaceId?: string;
    isolateShortTermMemory?: boolean;
    isolateLongTermMemory?: boolean;
    isolateTools?: boolean;
    autonomousSpawning?: boolean;
  };
  if (!body.label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const workspaceId = body.workspaceId ?? "default";
  const container = await getAppContainer();
  try {
    const created = await container.lifecycle.createSubAgent({
      id: body.id,
      label: body.label,
      workspaceId,
      parentId: body.parentId,
      isolateShortTermMemory: body.isolateShortTermMemory,
      isolateLongTermMemory: body.isolateLongTermMemory,
      isolateTools: body.isolateTools,
      autonomousSpawning: body.autonomousSpawning
    });
    publishEvent(container.eventBus, {
      type: "agent.spawned",
      agentId: created.id,
      parentId: created.parentId,
      workspaceId
    });
    publishEvent(container.eventBus, {
      type: "agent.status.changed",
      agentId: created.id,
      status: created.status,
      parentId: created.parentId,
      workspaceId
    });
    const prevHash = await container.auditRepo.latestHash();
    const currHash = crypto
      .createHash("sha256")
      .update(`${prevHash ?? ""}|agent.spawned|${workspaceId}|${created.id}|${new Date().toISOString()}`)
      .digest("hex");
    await container.auditRepo.addLog({
      action: "agent.spawned",
      actorType: "user",
      actorId: "local-ui",
      targetPath: "agents.registry",
      diffPath: "state:agent-create",
      summary: `Spawned agent '${created.id}' in workspace '${workspaceId}'.`,
      prevHash,
      currHash
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }

  return NextResponse.json({ ok: true, agents: container.orchestrator.listAgents(workspaceId) });
}
