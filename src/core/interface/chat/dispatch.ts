import type { AppContainer } from "@/src/core/container";
import type { AgentMode, AgentRunResult, RuntimeStep, TokenUsage, Attachment } from "@/src/core/types";
import type { ProviderId } from "@/src/core/providers/types";
import { executeSlashCommand, parseSlashCommand } from "@/src/core/interface/slash-commands";

function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0
  };
}

function fallbackResult(finalText: string): AgentRunResult {
  return {
    finalText,
    steps: [],
    usage: emptyUsage()
  };
}

function titleFromMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Untitled conversation";
  }
  return normalized.slice(0, 72);
}

function roomIdFor(input: {
  workspaceId: string;
  mode: AgentMode;
  chatId?: string;
  roomId?: string;
  agentId: string;
}) {
  if (input.roomId?.trim()) {
    return input.roomId.trim();
  }
  const chatId = input.chatId?.trim() || "local";
  return `${input.workspaceId}:${input.mode}:ui:${chatId}:${input.agentId}`;
}

function toolCallsFromSteps(steps: RuntimeStep[]) {
  return steps
    .filter((step) => step.phase === "tool" && step.toolId)
    .map((step) => ({
      toolId: step.toolId,
      detail: step.detail
    }));
}

async function ensureConversation(input: {
  container: AppContainer;
  workspaceId: string;
  agentId: string;
  mode: AgentMode;
  conversationId?: string;
  titleSeed: string;
}) {
  const existingId = input.conversationId?.trim();
  if (existingId) {
    const existing = await input.container.conversations.get(existingId);
    if (existing && existing.workspace_id === input.workspaceId) {
      return existing.id;
    }
  }

  const created = await input.container.conversations.create({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    mode: input.mode,
    title: titleFromMessage(input.titleSeed)
  });
  return created?.id ?? existingId ?? "";
}

async function writeUserMessage(input: {
  container: AppContainer;
  conversationId: string;
  agentId: string;
  content: string;
}) {
  await input.container.conversations.addMessage({
    conversationId: input.conversationId,
    role: "user",
    agentId: input.agentId,
    content: input.content
  });
}

async function writeAssistantMessage(input: {
  container: AppContainer;
  conversationId: string;
  agentId: string;
  content: string;
  steps?: RuntimeStep[];
  usage?: TokenUsage;
  artifacts?: Attachment[];
  metadata?: Record<string, unknown>;
}) {
  await input.container.conversations.addMessage({
    conversationId: input.conversationId,
    role: "assistant",
    agentId: input.agentId,
    content: input.content,
    toolCalls: toolCallsFromSteps(input.steps ?? []),
    metadata: {
      ...(input.metadata ?? {}),
      usage: input.usage ?? emptyUsage(),
      stepCount: (input.steps ?? []).length,
      artifacts: input.artifacts
    }
  });
}

export interface DispatchChatTurnInput {
  container: AppContainer;
  workspaceId: string;
  agentId: string;
  message: string;
  mode: AgentMode;
  chatId?: string;
  roomId?: string;
  roundLimit?: number;
  coordinatorId?: string;
  conversationId?: string;
  allowedTools?: string[];
  systemPromptOverride?: string;
  soulOverride?: string;
  provider?: ProviderId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  attachments?: Attachment[];
}

export interface DispatchChatTurnResult {
  conversationId: string;
  roomId: string;
  result: AgentRunResult;
  clearView?: boolean;
  slashCommand?: string;
}

export async function dispatchChatTurn(
  input: DispatchChatTurnInput
): Promise<DispatchChatTurnResult> {
  const roomId = roomIdFor({
    workspaceId: input.workspaceId,
    mode: input.mode,
    chatId: input.chatId,
    roomId: input.roomId,
    agentId: input.mode === "group" ? "main" : input.agentId
  });

  const parsed = parseSlashCommand(input.message);
  if (parsed?.command === "new") {
    const slash = await executeSlashCommand(parsed, {
      container: input.container,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      mode: input.mode,
      conversationId: input.conversationId
    });
    const createdConversationId =
      slash.conversationId ||
      (await ensureConversation({
        container: input.container,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        mode: input.mode,
        conversationId: input.conversationId,
        titleSeed: input.message
      }));
    await writeUserMessage({
      container: input.container,
      conversationId: createdConversationId,
      agentId: input.agentId,
      content: input.message
    });
    const text = slash.responseText ?? "Created new conversation.";
    const result = fallbackResult(text);
    await writeAssistantMessage({
      container: input.container,
      conversationId: createdConversationId,
      agentId: input.agentId,
      content: text,
      usage: result.usage,
      metadata: {
        slashCommand: parsed.command
      }
    });
    return {
      conversationId: createdConversationId,
      roomId,
      result,
      slashCommand: parsed.command
    };
  }

  const conversationId = await ensureConversation({
    container: input.container,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    mode: input.mode,
    conversationId: input.conversationId,
    titleSeed: input.message
  });

  await writeUserMessage({
    container: input.container,
    conversationId,
    agentId: input.agentId,
    content: input.message
  });

  if (parsed) {
    const slash = await executeSlashCommand(parsed, {
      container: input.container,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      mode: input.mode,
      conversationId
    });

    let effectiveConversationId = conversationId;
    if (slash.conversationId && slash.conversationId !== conversationId) {
      effectiveConversationId = slash.conversationId;
    }

    if (slash.orchestratorRequest) {
      const delegatedResult = await input.container.orchestrator.run({
        agentId: slash.orchestratorRequest.agentId ?? input.agentId,
        message: slash.orchestratorRequest.message,
        mode: slash.orchestratorRequest.mode ?? input.mode,
        source: "ui",
        chatId: input.chatId ?? "chat",
        roomId,
        roundLimit: input.roundLimit,
        coordinatorId: input.coordinatorId,
        workspaceId: input.workspaceId,
        allowedTools: input.allowedTools,
        systemPromptOverride: input.systemPromptOverride,
        soulOverride: input.soulOverride,
        provider: input.provider,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        attachments: input.attachments
      });
      await writeAssistantMessage({
        container: input.container,
        conversationId: effectiveConversationId,
        agentId: slash.orchestratorRequest.agentId ?? input.agentId,
        content: delegatedResult.finalText,
        steps: delegatedResult.steps,
        usage: delegatedResult.usage,
        artifacts: delegatedResult.artifacts,
        metadata: {
          slashCommand: parsed.command
        }
      });
      return {
        conversationId: effectiveConversationId,
        roomId,
        result: delegatedResult,
        slashCommand: parsed.command
      };
    }

    const text = slash.responseText ?? `Command /${parsed.command} handled.`;
    const result = fallbackResult(text);
    await writeAssistantMessage({
      container: input.container,
      conversationId: effectiveConversationId,
      agentId: input.agentId,
      content: text,
      usage: result.usage,
      metadata: {
        slashCommand: parsed.command,
        clearView: slash.clearView ?? false
      }
    });
    return {
      conversationId: effectiveConversationId,
      roomId,
      result,
      clearView: slash.clearView,
      slashCommand: parsed.command
    };
  }

  const result = await input.container.orchestrator.run({
    agentId: input.agentId,
    message: input.message,
    mode: input.mode,
    source: "ui",
    chatId: input.chatId ?? "chat",
    roomId,
    roundLimit: input.roundLimit,
    coordinatorId: input.coordinatorId,
    workspaceId: input.workspaceId,
    allowedTools: input.allowedTools,
    systemPromptOverride: input.systemPromptOverride,
    soulOverride: input.soulOverride,
    provider: input.provider,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    attachments: input.attachments
  });

  await writeAssistantMessage({
    container: input.container,
    conversationId,
    agentId: input.agentId,
    content: result.finalText,
    steps: result.steps,
    usage: result.usage,
    artifacts: result.artifacts
  });

  return {
    conversationId,
    roomId,
    result
  };
}
