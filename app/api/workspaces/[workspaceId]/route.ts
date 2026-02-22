import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(_request: Request, context: { params: { workspaceId: string } }) {
  const container = await getAppContainer();
  const workspace = await container.workspaces.get(context.params.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }
  const configs = await container.workspaces.listConfigs(context.params.workspaceId);
  const agents = container.orchestrator.listAgents(context.params.workspaceId);
  return NextResponse.json({ workspace, configs, agents });
}

export async function DELETE(_request: Request, context: { params: { workspaceId: string } }) {
  const container = await getAppContainer();
  try {
    await container.lifecycle.deleteWorkspaceAgents(context.params.workspaceId);
    await container.workspaces.delete(context.params.workspaceId);
    container.docs.record({
      source: "workspaces",
      detail: `Deleted workspace '${context.params.workspaceId}'.`
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}

export async function PATCH(request: Request, context: { params: { workspaceId: string } }) {
  const body = (await request.json()) as { name?: string; description?: string };
  const container = await getAppContainer();
  const updated = await container.workspaces.update(context.params.workspaceId, {
    name: body.name,
    description: body.description
  });
  if (!updated) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }
  container.docs.record({
    source: "workspaces",
    detail: `Updated workspace '${context.params.workspaceId}'.`
  });
  return NextResponse.json({ ok: true, workspace: updated });
}

