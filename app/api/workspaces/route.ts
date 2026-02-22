import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET() {
  const container = await getAppContainer();
  const workspaces = await container.workspaces.list();
  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "create" | "clone" | "export";
    id?: string;
    name?: string;
    description?: string;
    sourceWorkspaceId?: string;
    targetId?: string;
    targetName?: string;
    workspaceId?: string;
  };

  const action = body.action ?? "create";
  const container = await getAppContainer();

  if (action === "export") {
    const workspaceId = body.workspaceId ?? "default";
    const workspace = await container.workspaces.get(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "workspace not found" }, { status: 404 });
    }

    const configs = await container.workspaces.listConfigs(workspaceId);
    const agents = container.orchestrator.listAgents(workspaceId);
    return NextResponse.json({
      workspace,
      configs,
      agents
    });
  }

  if (action === "clone") {
    if (!body.sourceWorkspaceId || !body.targetName) {
      return NextResponse.json(
        { error: "sourceWorkspaceId and targetName are required for clone" },
        { status: 400 }
      );
    }
    try {
      const clonedId = await container.workspaces.cloneWorkspace(body.sourceWorkspaceId, {
        id: body.targetId,
        name: body.targetName,
        description: body.description
      });
      await container.lifecycle.cloneWorkspaceAgents(body.sourceWorkspaceId, clonedId);
      container.docs.record({
        source: "workspaces",
        detail: `Cloned workspace '${body.sourceWorkspaceId}' into '${clonedId}'.`
      });
      return NextResponse.json({ ok: true, workspaceId: clonedId });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    }
  }

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const workspaceId = await container.workspaces.create({
      id: body.id,
      name: body.name,
      description: body.description
    });
    await container.lifecycle.ensureWorkspace(workspaceId);
    container.docs.record({
      source: "workspaces",
      detail: `Created workspace '${workspaceId}'.`
    });
    return NextResponse.json({ ok: true, workspaceId });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}
