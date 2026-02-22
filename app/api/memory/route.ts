import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace") ?? undefined;
  const query = searchParams.get("q")?.trim();
  const kinds = searchParams.get("kinds")?.split(",").map((value) => value.trim()).filter(Boolean);
  const limit = Number(searchParams.get("limit") ?? 150);
  const exportMode = searchParams.get("export");
  const includeStats = searchParams.get("stats") === "1";
  const container = await getAppContainer();

  if (query) {
    const namespaces = namespace ? [namespace] : undefined;
    const matches = await container.memories.search({
      query,
      namespaces,
      kinds,
      limit: Number.isFinite(limit) ? limit : 20
    });
    const stats = includeStats ? await container.memories.usageStats(namespace) : undefined;
    if (exportMode === "json") {
      return NextResponse.json({
        export: {
          namespace: namespace ?? "all",
          generatedAt: new Date().toISOString(),
          entries: matches
        }
      });
    }
    return NextResponse.json({ memories: matches, mode: "search", stats });
  }

  const memories = await container.memories.list(namespace, Number.isFinite(limit) ? limit : 150);
  const stats = includeStats ? await container.memories.usageStats(namespace) : undefined;
  if (exportMode === "json") {
    return NextResponse.json({
      export: {
        namespace: namespace ?? "all",
        generatedAt: new Date().toISOString(),
        entries: memories
      }
    });
  }

  return NextResponse.json({ memories, mode: "list", stats });
}

export async function POST(request: Request) {
  const body = (await request.json()) as
    | { action: "pin"; memoryId?: number; pinned?: boolean; workspaceId?: string }
    | { action: "delete"; memoryId?: number; workspaceId?: string };

  const container = await getAppContainer();

  if (body.action === "pin") {
    if (!body.memoryId || typeof body.memoryId !== "number") {
      return NextResponse.json({ error: "memoryId is required" }, { status: 400 });
    }
    const ok = await container.memories.pin(body.memoryId, body.pinned ?? true);
    if (ok) {
      const workspaceId = "workspaceId" in body && body.workspaceId ? body.workspaceId : "default";
      publishEvent(container.eventBus, {
        type: "memory.write",
        agentId: "ui",
        namespace: `workspace:${workspaceId}`,
        kind: body.pinned ? "pin" : "unpin"
      });
    }
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }

  if (body.action === "delete") {
    if (!body.memoryId || typeof body.memoryId !== "number") {
      return NextResponse.json({ error: "memoryId is required" }, { status: 400 });
    }
    const ok = await container.memories.delete(body.memoryId);
    if (ok) {
      const workspaceId = "workspaceId" in body && body.workspaceId ? body.workspaceId : "default";
      publishEvent(container.eventBus, {
        type: "memory.write",
        agentId: "ui",
        namespace: `workspace:${workspaceId}`,
        kind: "delete"
      });
    }
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
