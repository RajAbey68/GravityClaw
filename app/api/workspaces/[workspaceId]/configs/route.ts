import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(_request: Request, context: { params: { workspaceId: string } }) {
  const container = await getAppContainer();
  const workspace = await container.workspaces.get(context.params.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }
  const configs = await container.workspaces.listConfigs(context.params.workspaceId);
  return NextResponse.json({ workspaceId: context.params.workspaceId, configs });
}

export async function POST(request: Request, context: { params: { workspaceId: string } }) {
  const body = (await request.json()) as {
    key?: string;
    value?: string | number | boolean;
  };
  if (!body.key || typeof body.key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const container = await getAppContainer();
  const workspace = await container.workspaces.get(context.params.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  await container.workspaces.setConfig(context.params.workspaceId, body.key, String(body.value ?? ""));
  container.docs.record({
    source: "workspaces",
    detail: `Updated workspace config '${body.key}' for '${context.params.workspaceId}'.`
  });

  return NextResponse.json({ ok: true });
}

