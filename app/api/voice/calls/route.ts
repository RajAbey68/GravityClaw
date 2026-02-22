import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const container = await getAppContainer();
  const calls = await container.callCoordinator.listSessions();
  if (!workspaceId) {
    return NextResponse.json({ calls });
  }
  const filtered: typeof calls = [];
  for (const call of calls) {
    const detail = await container.calls.getById(call.id);
    const scopedWorkspaceId = String((detail?.context as { workspaceId?: string } | undefined)?.workspaceId ?? "default");
    if (scopedWorkspaceId === workspaceId) {
      filtered.push(call);
    }
  }
  return NextResponse.json({ calls: filtered });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    toNumber?: string;
    agentId?: string;
    objective?: string;
    workspaceId?: string;
  };

  const toNumber = body.toNumber?.trim();
  if (!toNumber) {
    return NextResponse.json({ error: "toNumber is required" }, { status: 400 });
  }

  const container = await getAppContainer();
  const result = await container.callCoordinator.startOutboundCall({
    toNumber,
    agentId: body.agentId ?? "main",
    objective: body.objective?.trim() || "Handle outbound call",
    workspaceId: body.workspaceId ?? "default"
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
