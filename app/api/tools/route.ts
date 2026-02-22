import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeLogs = searchParams.get("logs") === "1";
  const toolId = searchParams.get("toolId") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 120);

  const container = await getAppContainer();
  const tools = container.tools.list();
  const pendingConfirmations = container.tools.listConfirmations();
  const logs = includeLogs
    ? await container.events.recentToolEvents(Number.isFinite(limit) ? limit : 120, toolId)
    : [];

  return NextResponse.json({
    tools,
    pendingConfirmations,
    logs
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "execute" | "confirm" | "config";
    toolId?: string;
    input?: unknown;
    agentId?: string;
    confirmationId?: string;
    enabled?: boolean;
    requireConfirmation?: boolean;
  };

  const container = await getAppContainer();
  const action = body.action ?? (body.confirmationId ? "confirm" : "execute");

  if (action === "config") {
    if (!body.toolId) {
      return NextResponse.json({ error: "toolId is required" }, { status: 400 });
    }
    if (!container.tools.has(body.toolId)) {
      return NextResponse.json({ error: "tool not found" }, { status: 404 });
    }

    container.tools.setConfig(body.toolId, {
      enabled: body.enabled ?? container.tools.getConfig(body.toolId).enabled,
      requireConfirmation:
        body.requireConfirmation ?? container.tools.getConfig(body.toolId).requireConfirmation
    });

    const serialized = JSON.stringify(
      Object.fromEntries(
        container.tools
          .list()
          .map((tool) => [tool.id, { enabled: tool.enabled, requireConfirmation: tool.requireConfirmation }])
      )
    );
    await container.memories.setSetting("tools.config", serialized);
    container.docs.record({
      source: "tools",
      detail: `Updated tool config for '${body.toolId}'.`
    });

    return NextResponse.json({ ok: true, tool: container.tools.list().find((tool) => tool.id === body.toolId) });
  }

  if (action === "confirm") {
    if (!body.confirmationId) {
      return NextResponse.json({ error: "confirmationId is required" }, { status: 400 });
    }
    const confirmed = await container.tools.executeConfirmation(body.confirmationId);
    return NextResponse.json(confirmed, { status: confirmed.ok ? 200 : 409 });
  }

  if (!body.toolId) {
    return NextResponse.json({ error: "toolId is required" }, { status: 400 });
  }

  const execution = await container.tools.execute(body.toolId, body.input ?? {}, {
    agentId: body.agentId ?? "main",
    requireConfirmation: true,
    confirmed: false
  });

  return NextResponse.json(execution, { status: execution.ok ? 200 : execution.requiresConfirmation ? 202 : 409 });
}

