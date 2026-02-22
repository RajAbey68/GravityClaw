import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const agentId = searchParams.get("agentId") ?? undefined;
  const limit = toInt(searchParams.get("limit"), 40);
  const offset = toInt(searchParams.get("offset"), 0);
  const container = await getAppContainer();
  const conversations = await container.conversations.list({
    workspaceId,
    agentId,
    limit,
    offset
  });
  return NextResponse.json({
    workspaceId,
    conversations
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    workspaceId?: string;
    agentId?: string;
    mode?: "direct" | "delegated" | "group";
    title?: string;
    id?: string;
  };
  const workspaceId = body.workspaceId ?? "default";
  const agentId = body.agentId?.trim() || "main";
  const mode = body.mode ?? "direct";
  const container = await getAppContainer();
  const conversation = await container.conversations.create({
    workspaceId,
    agentId,
    mode,
    title: body.title,
    id: body.id
  });
  return NextResponse.json({
    conversation
  });
}
