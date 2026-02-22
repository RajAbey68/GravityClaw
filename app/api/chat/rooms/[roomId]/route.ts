import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { dispatchChatTurn } from "@/src/core/interface/chat/dispatch";
import type { ProviderId } from "@/src/core/providers/types";

export async function GET(request: Request, context: { params: { roomId: string } }) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 120);
  const container = await getAppContainer();
  const messages = await container.collaboration.recentRoomMessages(
    context.params.roomId,
    Number.isFinite(limit) ? limit : 120
  );
  return NextResponse.json({ roomId: context.params.roomId, messages: messages.reverse() });
}

export async function POST(request: Request, context: { params: { roomId: string } }) {
  const body = (await request.json()) as {
    workspaceId?: string;
    agentId?: string;
    message?: string;
    mode?: "direct" | "delegated" | "group";
    chatId?: string;
    roundLimit?: number;
    coordinatorId?: string;
    allowedTools?: string[];
    systemPromptOverride?: string;
    soulOverride?: string;
    provider?: ProviderId;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    conversationId?: string;
  };

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const roomId = context.params.roomId;
  const workspaceId = body.workspaceId ?? "default";
  const container = await getAppContainer();
  const dispatched = await dispatchChatTurn({
    container,
    workspaceId,
    agentId: body.agentId ?? "main",
    message,
    mode: body.mode ?? "direct",
    chatId: body.chatId ?? "room-ui",
    roomId,
    roundLimit: body.roundLimit,
    coordinatorId: body.coordinatorId,
    conversationId: body.conversationId,
    allowedTools: body.allowedTools,
    systemPromptOverride: body.systemPromptOverride,
    soulOverride: body.soulOverride,
    provider: body.provider,
    model: body.model,
    temperature: body.temperature,
    maxTokens: body.maxTokens
  });

  return NextResponse.json({
    roomId: dispatched.roomId,
    conversationId: dispatched.conversationId,
    result: dispatched.result,
    clearView: dispatched.clearView ?? false,
    slashCommand: dispatched.slashCommand
  });
}
