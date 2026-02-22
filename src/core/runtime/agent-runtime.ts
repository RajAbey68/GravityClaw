import { ContextAssembler } from "@/src/core/runtime/context-assembler";
import { EventRepository } from "@/src/core/memory/repositories/events";
import { SessionRepository } from "@/src/core/memory/repositories/sessions";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";
import { ProviderRegistry } from "@/src/core/providers/provider-registry";
import { ToolRegistry } from "@/src/core/tools/registry";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import type { AgentRunRequest, AgentRunResult } from "@/src/core/types";
import { runAgentLoop } from "@/src/core/runtime/loop";
import { SkillService } from "@/src/core/skills/skill-service";

export class AgentRuntime {
  private readonly contextAssembler: ContextAssembler;

  constructor(
    private readonly sessions: SessionRepository,
    private readonly memories: MemoryRepository,
    private readonly events: EventRepository,
    private readonly providerRegistry: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly eventBus: SystemEventBus,
    private readonly maxIterations: number,
    private readonly skills: SkillService
  ) {
    this.contextAssembler = new ContextAssembler(this.sessions, this.memories);
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const workspaceId = request.workspaceId ?? "default";
    const sessionKey = `${workspaceId}:${request.source ?? "ui"}:${request.chatId ?? "local"}:${request.agentId}`;
    await this.sessions.ensure(sessionKey, request.agentId, request.source ?? "ui");
    await this.sessions.addMessage(sessionKey, "user", request.message);

    const shortTermNamespace = `workspace:${workspaceId}:agent:${request.agentId}`;
    const longTermPrimaryNamespace = request.memoryNamespace ?? `workspace:${workspaceId}:main`;
    const longTermNamespaces =
      longTermPrimaryNamespace === `workspace:${workspaceId}:main`
        ? [longTermPrimaryNamespace]
        : [longTermPrimaryNamespace, `workspace:${workspaceId}:main`];
    const skillPrompts = await this.skills.promptsForAgent(`${workspaceId}:${request.agentId}`);
    const roomContext = request.roomId ? `room_id=${request.roomId}\nmode=${request.mode}` : `mode=${request.mode}`;

    const assembled = await this.contextAssembler.assemble(sessionKey, request.message, {
      workspaceId,
      shortTermNamespace,
      longTermNamespaces,
      agentId: request.agentId,
      roomContext,
      skillPrompts,
      systemPromptOverride: request.systemPromptOverride,
      soulOverride: request.soulOverride
    });
    publishEvent(this.eventBus, {
      type: "memory.read",
      agentId: request.agentId,
      namespace: longTermNamespaces.join(","),
      count: assembled.memoryCount
    });
    const parsedIterationLimit = Number(await this.memories.getSetting("global.iterationLimit"));
    const parsedMaxTokenLimit = Number(await this.memories.getSetting("global.maxTokenLimit"));
    const reflectionSetting = (await this.memories.getSetting("global.reflectionEnabled")) ?? "true";
    const dangerousConfirmationSetting =
      (await this.memories.getSetting("global.security.requireDangerousConfirmation")) ?? "true";
    const thinkingLevelSetting =
      (await this.memories.getSetting(`agent.thinkingLevel:${workspaceId}:${request.agentId}`)) ?? "off";
    const maxIterations =
      Number.isFinite(parsedIterationLimit) && parsedIterationLimit > 0
        ? Math.min(this.maxIterations, Math.max(1, Math.floor(parsedIterationLimit)))
        : this.maxIterations;
    const maxTokenLimit =
      Number.isFinite(parsedMaxTokenLimit) && parsedMaxTokenLimit >= 64
        ? Math.min(32000, Math.max(64, Math.floor(parsedMaxTokenLimit)))
        : undefined;
    const reflectionEnabled = ["1", "true", "yes", "on"].includes(reflectionSetting.toLowerCase());
    const requireToolConfirmation = ["1", "true", "yes", "on"].includes(
      dangerousConfirmationSetting.toLowerCase()
    );
    const thinkingLevel =
      thinkingLevelSetting === "low" ||
      thinkingLevelSetting === "medium" ||
      thinkingLevelSetting === "high"
        ? thinkingLevelSetting
        : "off";
    const requestedMaxTokens = request.maxTokens ?? maxTokenLimit ?? 650;
    const effectiveMaxTokens = maxTokenLimit
      ? Math.min(maxTokenLimit, requestedMaxTokens)
      : requestedMaxTokens;

    const result = await runAgentLoop({
      agentId: request.agentId,
      workspaceId,
      memoryNamespace: longTermPrimaryNamespace,
      message: request.message,
      systemPrompt: assembled.systemPrompt,
      history: assembled.messages,
      maxIterations,
      providerRegistry: this.providerRegistry,
      toolRegistry: this.tools,
      eventBus: this.eventBus,
      allowedTools: request.allowedTools,
      providerOverride: request.provider,
      modelOverride: request.model,
      maxTokens: effectiveMaxTokens,
      reflectionEnabled,
      requireToolConfirmation,
      thinkingLevel
    });

    await this.sessions.addMessage(sessionKey, "assistant", result.finalText);
    await this.events.addRuntimeSteps(sessionKey, result.steps);
    await this.events.addProviderUsage(sessionKey, result.providerMeta.provider, result.providerMeta.model, result.usage);
    if (result.toolEvent) {
      await this.events.addToolEvent(
        sessionKey,
        result.toolEvent.toolId,
        result.toolEvent.risk,
        result.toolEvent.status,
        result.toolEvent.detail
      );
      publishEvent(this.eventBus, {
        type: "tool.invoked",
        agentId: request.agentId,
        toolId: result.toolEvent.toolId,
        risk: result.toolEvent.risk
      });
    }

    publishEvent(this.eventBus, {
      type: "provider.usage",
      agentId: request.agentId,
      provider: result.providerMeta.provider,
      model: result.providerMeta.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd
    });
    publishEvent(this.eventBus, {
      type: "provider.usage.updated",
      agentId: request.agentId,
      provider: result.providerMeta.provider,
      model: result.providerMeta.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd
    });

    await this.memories.addShortTerm(workspaceId, shortTermNamespace, request.message);
    publishEvent(this.eventBus, {
      type: "memory.write",
      agentId: request.agentId,
      namespace: shortTermNamespace,
      kind: "short-term"
    });
    await this.memories.archiveShortTerm(workspaceId, shortTermNamespace, 24);
    if (result.finalText.trim()) {
      const summary = result.finalText.slice(0, 340);
      await this.memories.addLongTerm(workspaceId, longTermPrimaryNamespace, "summary", summary);
      publishEvent(this.eventBus, {
        type: "memory.write",
        agentId: request.agentId,
        namespace: longTermPrimaryNamespace,
        kind: "long-term:summary"
      });
    }

    return {
      finalText: result.finalText,
      steps: result.steps,
      usage: result.usage
    };
  }
}
