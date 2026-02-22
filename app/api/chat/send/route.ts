import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { dispatchChatTurn } from "@/src/core/interface/chat/dispatch";
import type { ProviderId } from "@/src/core/providers/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    agentId?: string;
    message?: string;
    mode?: "direct" | "delegated" | "group";
    chatId?: string;
    roomId?: string;
    roundLimit?: number;
    coordinatorId?: string;
    workspaceId?: string;
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

  const container = await getAppContainer();
  const dispatched = await dispatchChatTurn({
    container,
    workspaceId: body.workspaceId ?? "default",
    agentId: body.agentId ?? "main",
    message,
    mode: body.mode ?? "direct",
    chatId: body.chatId ?? "local",
    roomId: body.roomId,
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
    conversationId: dispatched.conversationId,
    roomId: dispatched.roomId,
    result: dispatched.result,
    clearView: dispatched.clearView ?? false,
    slashCommand: dispatched.slashCommand
  });
}
