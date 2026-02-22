import type { RuntimeStep, TokenUsage } from "@/src/core/types";
import type { ProviderId } from "@/src/core/providers/types";
import { reflectOnOutput } from "@/src/core/runtime/reflection";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

interface LoopParams {
  agentId: string;
  workspaceId: string;
  memoryNamespace: string;
  message: string;
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  maxIterations: number;
  providerRegistry: {
    generate(input: {
      systemPrompt: string;
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      maxTokens?: number;
      provider?: ProviderId;
      model?: string;
      thinkingLevel?: "off" | "low" | "medium" | "high";
    }): Promise<{
      text: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      provider: string;
      model: string;
    }>;
    getCurrent(): { provider: string; model: string };
  };
  toolRegistry: {
    execute<TInput, TOutput>(
      toolId: string,
      input: TInput,
      context: { agentId: string; workspaceId: string; requireConfirmation: boolean; confirmed: boolean }
    ): Promise<
      | { ok: true; output: TOutput }
      | {
          ok: false;
          reason: string;
          requiresConfirmation?: boolean;
          confirmation?: { id: string };
        }
    >;
  };
  eventBus: SystemEventBus;
  allowedTools?: string[];
  providerOverride?: ProviderId;
  modelOverride?: string;
  maxTokens?: number;
  reflectionEnabled?: boolean;
  requireToolConfirmation?: boolean;
  thinkingLevel?: "off" | "low" | "medium" | "high";
}

export interface LoopResult {
  finalText: string;
  steps: RuntimeStep[];
  usage: TokenUsage;
  toolEvent?: { toolId: string; risk: string; status: string; detail: string };
  providerMeta: { provider: string; model: string };
}

function emitStepStarted(eventBus: SystemEventBus, agentId: string, step: string, iteration: number) {
  publishEvent(eventBus, {
    type: "agent.step.started",
    agentId,
    step,
    iteration
  });
}

function emitStepCompleted(
  eventBus: SystemEventBus,
  agentId: string,
  step: string,
  iteration: number,
  detail?: string
) {
  publishEvent(eventBus, {
    type: "agent.step.completed",
    agentId,
    step,
    iteration,
    detail
  });
}

function emitToolCalled(eventBus: SystemEventBus, agentId: string, toolId: string, inputPreview: string) {
  publishEvent(eventBus, {
    type: "tool.called",
    agentId,
    toolId,
    inputPreview
  });
}

function emitToolCompleted(
  eventBus: SystemEventBus,
  agentId: string,
  toolId: string,
  status: string,
  detail: string
) {
  publishEvent(eventBus, {
    type: "tool.completed",
    agentId,
    toolId,
    status,
    detail: detail.slice(0, 300)
  });
}

function parseToolCommand(message: string) {
  const trimmed = message.trim();
  if (!trimmed.toLowerCase().startsWith("/tool ")) {
    return undefined;
  }

  const payload = trimmed.replace(/^\/tool\s+/i, "").trim();
  if (!payload) return undefined;

  const [toolId, ...rest] = payload.split(" ");
  const inputRaw = rest.join(" ").trim();
  let input: Record<string, unknown> = {};
  if (inputRaw) {
    try {
      input = JSON.parse(inputRaw) as Record<string, unknown>;
    } catch {
      input = { raw: inputRaw };
    }
  }

  return { toolId, input };
}

function estimateFallbackUsage(message: string): TokenUsage {
  return {
    inputTokens: Math.ceil(message.length / 4),
    outputTokens: 20,
    estimatedCostUsd: 0
  };
}

function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    estimatedCostUsd: Number((total.estimatedCostUsd + next.estimatedCostUsd).toFixed(6))
  };
}

function isToolAllowed(allowedTools: string[] | undefined, toolId: string) {
  if (!allowedTools || allowedTools.length === 0) {
    return true;
  }
  return allowedTools.includes(toolId);
}

export async function runAgentLoop(params: LoopParams): Promise<LoopResult> {
  const steps: RuntimeStep[] = [];
  const iterativeHistory = [...params.history];
  let aggregatedUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0
  };
  let lastGeneratedText = "";
  let lastProviderMeta = params.providerRegistry.getCurrent();

  for (let iteration = 1; iteration <= params.maxIterations; iteration += 1) {
    emitStepStarted(params.eventBus, params.agentId, "reasoning", iteration);
    const detail = `iteration-${iteration}:reasoning`;
    steps.push({ iteration, phase: "reasoning", detail });
    publishEvent(params.eventBus, {
      type: "agent.step",
      agentId: params.agentId,
      detail,
      iteration
    });
    emitStepCompleted(params.eventBus, params.agentId, "reasoning", iteration, detail);

    const lower = params.message.toLowerCase();
    const genericTool = parseToolCommand(params.message);
    if (genericTool) {
      emitStepStarted(params.eventBus, params.agentId, "tool", iteration);
      emitToolCalled(params.eventBus, params.agentId, genericTool.toolId, JSON.stringify(genericTool.input).slice(0, 180));
      if (!isToolAllowed(params.allowedTools, genericTool.toolId)) {
        emitToolCompleted(params.eventBus, params.agentId, genericTool.toolId, "blocked", "agent-tool-disabled");
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "blocked: agent-tool-disabled");
        return {
          finalText: `Tool '${genericTool.toolId}' is disabled for this agent.`,
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: genericTool.toolId,
            risk: "unknown",
            status: "blocked",
            detail: "agent-tool-disabled"
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }

      const toolResult = await params.toolRegistry.execute(genericTool.toolId, genericTool.input, {
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        requireConfirmation: params.requireToolConfirmation ?? true,
        confirmed: false
      });

      if (toolResult.ok) {
        const detail = JSON.stringify(toolResult.output);
        steps.push({ iteration, phase: "tool", detail, toolId: genericTool.toolId });
        emitToolCompleted(params.eventBus, params.agentId, genericTool.toolId, "ok", detail);
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "ok");
        return {
          finalText: `Tool '${genericTool.toolId}' executed:\n${detail}`,
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: genericTool.toolId,
            risk: "unknown",
            status: "ok",
            detail
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }

      const reason = toolResult.requiresConfirmation
        ? `${toolResult.reason} (confirmationId=${toolResult.confirmation?.id ?? "unknown"})`
        : toolResult.reason;
      emitToolCompleted(params.eventBus, params.agentId, genericTool.toolId, "blocked", reason);
      emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, reason);

      return {
        finalText: `Tool '${genericTool.toolId}' blocked: ${reason}`,
        steps,
        usage: estimateFallbackUsage(params.message),
        toolEvent: {
          toolId: genericTool.toolId,
          risk: "unknown",
          status: "blocked",
          detail: reason
        },
        providerMeta: params.providerRegistry.getCurrent()
      };
    }

    if (lower.startsWith("/memory search ")) {
      emitStepStarted(params.eventBus, params.agentId, "tool", iteration);
      emitToolCalled(params.eventBus, params.agentId, "memory-search", params.message.slice(0, 180));
      if (!isToolAllowed(params.allowedTools, "memory-search")) {
        emitToolCompleted(params.eventBus, params.agentId, "memory-search", "blocked", "agent-tool-disabled");
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "blocked");
        return {
          finalText: "Tool 'memory-search' is disabled for this agent.",
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: "memory-search",
            risk: "safe",
            status: "blocked",
            detail: "agent-tool-disabled"
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }

      const query = params.message.replace(/^\/memory search\s+/i, "").trim();
      const toolResult = await params.toolRegistry.execute("memory-search", {
        query,
        namespaces: [params.memoryNamespace],
        limit: 8
      }, {
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        requireConfirmation: params.requireToolConfirmation ?? true,
        confirmed: true
      });

      if (toolResult.ok) {
        const toolDetail = JSON.stringify(toolResult.output);
        steps.push({ iteration, phase: "tool", detail: toolDetail, toolId: "memory-search" });
        emitToolCompleted(params.eventBus, params.agentId, "memory-search", "ok", toolDetail);
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "ok");
        return {
          finalText: `Memory search completed:\n${toolDetail}`,
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: "memory-search",
            risk: "safe",
            status: "ok",
            detail: toolDetail
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }
      emitToolCompleted(params.eventBus, params.agentId, "memory-search", "failed", "memory-search failed");
      emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "failed");
    }

    if (lower.startsWith("/memory write ")) {
      emitStepStarted(params.eventBus, params.agentId, "tool", iteration);
      emitToolCalled(params.eventBus, params.agentId, "memory-write", params.message.slice(0, 180));
      if (!isToolAllowed(params.allowedTools, "memory-write")) {
        emitToolCompleted(params.eventBus, params.agentId, "memory-write", "blocked", "agent-tool-disabled");
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "blocked");
        return {
          finalText: "Tool 'memory-write' is disabled for this agent.",
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: "memory-write",
            risk: "safe",
            status: "blocked",
            detail: "agent-tool-disabled"
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }

      const body = params.message.replace(/^\/memory write\s+/i, "").trim();
      const [kindRaw, ...contentParts] = body.split(" ");
      const content = contentParts.join(" ").trim();
      const kind = kindRaw || "note";

      const toolResult = await params.toolRegistry.execute("memory-write", {
        namespace: params.memoryNamespace,
        kind,
        content: content || body
      }, {
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        requireConfirmation: params.requireToolConfirmation ?? true,
        confirmed: true
      });

      if (toolResult.ok) {
        const toolDetail = JSON.stringify(toolResult.output);
        steps.push({ iteration, phase: "tool", detail: toolDetail, toolId: "memory-write" });
        emitToolCompleted(params.eventBus, params.agentId, "memory-write", "ok", toolDetail);
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "ok");
        return {
          finalText: `Memory write completed:\n${toolDetail}`,
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: "memory-write",
            risk: "safe",
            status: "ok",
            detail: toolDetail
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }
      emitToolCompleted(params.eventBus, params.agentId, "memory-write", "failed", "memory-write failed");
      emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "failed");
    }

    if (lower.includes("health check") || lower.includes("/health")) {
      emitStepStarted(params.eventBus, params.agentId, "tool", iteration);
      emitToolCalled(params.eventBus, params.agentId, "health-check", params.message.slice(0, 180));
      if (!isToolAllowed(params.allowedTools, "health-check")) {
        emitToolCompleted(params.eventBus, params.agentId, "health-check", "blocked", "agent-tool-disabled");
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "blocked");
        return {
          finalText: "Tool 'health-check' is disabled for this agent.",
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: "health-check",
            risk: "safe",
            status: "blocked",
            detail: "agent-tool-disabled"
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }

      const toolResult = await params.toolRegistry.execute("health-check", { requestId: params.agentId }, {
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        requireConfirmation: params.requireToolConfirmation ?? true,
        confirmed: true
      });

      if (toolResult.ok) {
        const toolDetail = JSON.stringify(toolResult.output);
        steps.push({ iteration, phase: "tool", detail: toolDetail, toolId: "health-check" });
        emitToolCompleted(params.eventBus, params.agentId, "health-check", "ok", toolDetail);
        emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, "ok");
        return {
          finalText: `Health check completed:\n${toolDetail}`,
          steps,
          usage: estimateFallbackUsage(params.message),
          toolEvent: {
            toolId: "health-check",
            risk: "safe",
            status: "ok",
            detail: toolDetail
          },
          providerMeta: params.providerRegistry.getCurrent()
        };
      }
      emitToolCompleted(params.eventBus, params.agentId, "health-check", "blocked", toolResult.reason);
      emitStepCompleted(params.eventBus, params.agentId, "tool", iteration, toolResult.reason);

      return {
        finalText: `Tool blocked: ${toolResult.reason}`,
        steps,
        usage: estimateFallbackUsage(params.message),
        toolEvent: {
          toolId: "health-check",
          risk: "safe",
          status: "blocked",
          detail: toolResult.reason
        },
        providerMeta: params.providerRegistry.getCurrent()
      };
    }

    let generated:
      | {
          text: string;
          inputTokens: number;
          outputTokens: number;
          estimatedCostUsd: number;
          provider: string;
          model: string;
        }
      | undefined;

    try {
      emitStepStarted(params.eventBus, params.agentId, "reasoning-model", iteration);
      generated = await params.providerRegistry.generate({
        systemPrompt: params.systemPrompt,
        messages: iterativeHistory,
        maxTokens: params.maxTokens ?? 650,
        provider: params.providerOverride,
        model: params.modelOverride,
        thinkingLevel: params.thinkingLevel
      });
      emitStepCompleted(params.eventBus, params.agentId, "reasoning-model", iteration, `${generated.provider}/${generated.model}`);
      lastProviderMeta = {
        provider: generated.provider,
        model: generated.model
      };
      aggregatedUsage = addUsage(aggregatedUsage, {
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        estimatedCostUsd: generated.estimatedCostUsd
      });
    } catch (error) {
      const message = `Provider execution failed: ${(error as Error).message}`;
      steps.push({ iteration, phase: "reflection", detail: message });
      emitStepCompleted(params.eventBus, params.agentId, "reasoning-model", iteration, message);
      publishEvent(params.eventBus, {
        type: "system.info",
        detail: `[${params.agentId}] ${message}`
      });
      lastGeneratedText = message;
      if (iteration < params.maxIterations) {
        iterativeHistory.push({
          role: "system",
          content: `${message}\nRetry with a fallback strategy and concise response.`
        });
        continue;
      }
      break;
    }

    const reflectionEnabled = params.reflectionEnabled ?? true;
    if (!reflectionEnabled) {
      emitStepStarted(params.eventBus, params.agentId, "final", iteration);
      steps.push({ iteration, phase: "final", detail: "response-ready (reflection-disabled)" });
      emitStepCompleted(params.eventBus, params.agentId, "final", iteration, "response-ready");
      return {
        finalText: generated.text,
        steps,
        usage: aggregatedUsage,
        providerMeta: {
          provider: generated.provider,
          model: generated.model
        }
      };
    }

    emitStepStarted(params.eventBus, params.agentId, "reflection", iteration);
    const reflection = reflectOnOutput(generated.text);
    const reflectionDetail = `${reflection.summary} remediation=${reflection.remediation}`;
    steps.push({ iteration, phase: "reflection", detail: reflectionDetail });
    emitStepCompleted(params.eventBus, params.agentId, "reflection", iteration, reflection.summary);
    lastGeneratedText = generated.text;

    if (reflection.verdict === "pass") {
      emitStepStarted(params.eventBus, params.agentId, "final", iteration);
      steps.push({ iteration, phase: "final", detail: "response-ready" });
      emitStepCompleted(params.eventBus, params.agentId, "final", iteration, "response-ready");

      return {
        finalText: generated.text,
        steps,
        usage: aggregatedUsage,
        providerMeta: {
          provider: generated.provider,
          model: generated.model
        }
      };
    }

    if (iteration < params.maxIterations) {
      iterativeHistory.push({ role: "assistant", content: generated.text });
      iterativeHistory.push({
        role: "system",
        content: `Self-healing reflection: ${reflection.remediation}`
      });
      iterativeHistory.push({
        role: "user",
        content:
          "Revise the previous answer so it is specific, actionable, and complete. Keep the same intent."
      });
      publishEvent(params.eventBus, {
        type: "system.info",
        detail: `[${params.agentId}] Reflection retry requested on iteration ${iteration}.`
      });
    }
  }

  const lastSnippet = lastGeneratedText.trim()
    ? `\nLast draft:\n${lastGeneratedText.slice(0, 500)}`
    : "";
  return {
    finalText: `Iteration limit reached before obtaining a stable response.${lastSnippet}`,
    steps,
    usage:
      aggregatedUsage.inputTokens || aggregatedUsage.outputTokens
        ? aggregatedUsage
        : estimateFallbackUsage(params.message),
    providerMeta: lastProviderMeta
  };
}
