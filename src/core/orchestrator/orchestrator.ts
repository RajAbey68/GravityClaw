import { randomUUID } from "node:crypto";
import { AgentRuntime } from "@/src/core/runtime/agent-runtime";
import { AgentLifecycle } from "@/src/core/orchestrator/lifecycle";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { ForgeController } from "@/src/core/forge/forge-controller";
import { resolveDelegationObjective } from "@/src/core/orchestrator/delegation";
import { CollaborationRepository } from "@/src/core/memory/repositories/collaboration";
import type {
  AgentDescriptor,
  AgentRunRequest,
  AgentRunResult,
  AgentRoundResult,
  RuntimeStep,
  TokenUsage
} from "@/src/core/types";

function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roomKey(request: AgentRunRequest, fallbackAgentId: string) {
  const source = request.source ?? "ui";
  const chatId = request.chatId ?? "local";
  const workspaceId = request.workspaceId ?? "default";
  return request.roomId ?? `${workspaceId}:${request.mode}:${source}:${chatId}:${fallbackAgentId}`;
}

function parseSpawnCommand(message: string) {
  const trimmed = message.trim();
  if (!trimmed.toLowerCase().startsWith("/spawn ")) {
    return undefined;
  }

  const payload = trimmed.replace(/^\/spawn\s+/i, "").trim();
  if (!payload) {
    return undefined;
  }

  if (payload.includes(":")) {
    const [id, label] = payload.split(":", 2).map((chunk) => chunk.trim());
    if (!id || !label) {
      return undefined;
    }
    return { id, label };
  }

  return {
    label: payload
  };
}

function parseForgeCommand(message: string) {
  const trimmed = message.trim();
  if (!trimmed.toLowerCase().startsWith("/forge ")) {
    return undefined;
  }
  const capability = trimmed.replace(/^\/forge\s+/i, "").trim();
  return capability || undefined;
}

function summarize(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function chunkText(text: string, size = 48) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [""];
}

export class Orchestrator {
  constructor(
    private readonly runtime: AgentRuntime,
    private readonly lifecycle: AgentLifecycle,
    private readonly collaboration: CollaborationRepository,
    private readonly eventBus: SystemEventBus,
    private readonly forge: ForgeController,
    private readonly maxGroupRounds: number
  ) {}

  getLifecycle() {
    return this.lifecycle;
  }

  listAgents(workspaceId = "default") {
    return this.lifecycle.list(workspaceId);
  }

  listAllAgents() {
    return this.lifecycle.listAll();
  }

  async activeRooms(workspaceId?: string) {
    const rooms = await this.collaboration.activeRooms();
    if (!workspaceId) {
      return rooms;
    }
    return rooms.filter((room) => room.id.startsWith(`${workspaceId}:`));
  }

  private resolveMemoryNamespace(agent: AgentDescriptor, workspaceId: string) {
    const target = agent.isolateLongTermMemory ? agent.id : "main";
    return `workspace:${workspaceId}:${target}`;
  }

  private async runSingleAgent(
    request: AgentRunRequest,
    agent: AgentDescriptor
  ): Promise<AgentRunResult> {
    const workspaceId = request.workspaceId ?? "default";
    if (agent.status === "paused") {
      return {
        finalText: `Agent '${agent.id}' is paused. Resume it before running new tasks.`,
        steps: [],
        usage: emptyUsage()
      };
    }
    await this.lifecycle.updateStatus(agent.id, "busy", workspaceId);
    publishEvent(this.eventBus, {
      type: "agent.lifecycle",
      agentId: agent.id,
      action: "status",
      status: "busy",
      parentId: agent.parentId
    });
    publishEvent(this.eventBus, {
      type: "agent.status.changed",
      agentId: agent.id,
      status: "busy",
      parentId: agent.parentId,
      workspaceId
    });

    try {
      const result = await this.runtime.run({
        ...request,
        agentId: agent.id,
        memoryNamespace: this.resolveMemoryNamespace(agent, workspaceId),
        mode: "direct",
        allowedTools: agent.enabledTools,
        systemPromptOverride: agent.systemPromptOverride,
        soulOverride: agent.soulOverride,
        provider: agent.provider,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        attachments: request.attachments
      });

      await this.tryForgeOnFailure(`${workspaceId}:${agent.id}`, request.message, result.finalText);
      this.emitResponseStream(request.roomId, agent.id, result);
      return result;
    } finally {
      await this.lifecycle.updateStatus(agent.id, agent.id === "main" ? "active" : "idle", workspaceId);
      publishEvent(this.eventBus, {
        type: "agent.lifecycle",
        agentId: agent.id,
        action: "status",
        status: agent.id === "main" ? "active" : "idle",
        parentId: agent.parentId
      });
      publishEvent(this.eventBus, {
        type: "agent.status.changed",
        agentId: agent.id,
        status: agent.id === "main" ? "active" : "idle",
        parentId: agent.parentId,
        workspaceId
      });
    }
  }

  private emitResponseStream(roomId: string | undefined, agentId: string, result: AgentRunResult) {
    const streamId = randomUUID();
    const chunks = chunkText(result.finalText, 52);
    chunks.forEach((chunk, index) => {
      publishEvent(this.eventBus, {
        type: "agent.stream.delta",
        streamId,
        roomId,
        agentId,
        chunk,
        chunkIndex: index
      });
    });
    publishEvent(this.eventBus, {
      type: "agent.stream.completed",
      streamId,
      roomId,
      agentId,
      finalText: result.finalText,
      steps: result.steps,
      usage: result.usage
    });
  }

  private async tryForgeOnFailure(agentId: string, message: string, finalText: string) {
    const lower = finalText.toLowerCase();
    const isFailure =
      lower.includes("iteration limit reached") ||
      lower.includes("tool blocked") ||
      lower.includes("all configured providers are unavailable");

    if (!isFailure) {
      return;
    }

    await this.forge.maybeCreateFromFailure({
      agentId,
      message,
      failure: finalText
    });
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const workspaceId = request.workspaceId ?? "default";
    await this.lifecycle.ensureWorkspace(workspaceId);

    const forgeCommand = parseForgeCommand(request.message);
    if (forgeCommand) {
      const created = await this.forge.createManualJob({
        agentId: `${workspaceId}:${request.agentId}`,
        capability: forgeCommand,
        trigger: "manual"
      });
      return {
        finalText: `Forge job queued for capability: ${forgeCommand}\njob_id=${created.jobId}`,
        steps: [],
        usage: emptyUsage()
      };
    }

    const spawnCommand = parseSpawnCommand(request.message);
    if (spawnCommand) {
      const created = await this.lifecycle.createSubAgent({
        id: spawnCommand.id,
        label: spawnCommand.label,
        workspaceId,
        parentId: "main"
      });

      publishEvent(this.eventBus, {
        type: "agent.lifecycle",
        agentId: created.id,
        action: "spawned",
        status: created.status,
        parentId: created.parentId
      });
      publishEvent(this.eventBus, {
        type: "agent.spawned",
        agentId: created.id,
        parentId: created.parentId,
        workspaceId
      });
      publishEvent(this.eventBus, {
        type: "agent.status.changed",
        agentId: created.id,
        status: created.status,
        parentId: created.parentId,
        workspaceId
      });

      return {
        finalText: `Spawned sub-agent '${created.label}' (${created.id}).`,
        steps: [],
        usage: emptyUsage()
      };
    }

    if (request.message.trim().toLowerCase() === "/agents") {
      const listing = this.lifecycle
        .list(workspaceId)
        .map((agent) => `- ${agent.id} (${agent.status})`)
        .join("\n");
      return {
        finalText: `Registered agents:\n${listing}`,
        steps: [],
        usage: emptyUsage()
      };
    }

    if (request.mode === "group") {
      return this.runGroupMode({ ...request, workspaceId });
    }

    if (request.mode === "delegated") {
      return this.runDelegatedMode({ ...request, workspaceId });
    }

    return this.runDirectMode({ ...request, workspaceId });
  }

  private async runDirectMode(request: AgentRunRequest) {
    const workspaceId = request.workspaceId ?? "default";
    const agentId = this.lifecycle.has(request.agentId, workspaceId) ? request.agentId : "main";
    const agent = this.lifecycle.get(agentId, workspaceId);
    if (!agent) {
      return {
        finalText: "Target agent not found.",
        steps: [],
        usage: emptyUsage()
      };
    }
    if (agent.status === "paused") {
      return {
        finalText: `Agent '${agent.id}' is paused.`,
        steps: [],
        usage: emptyUsage()
      };
    }

    const rid = roomKey(request, agent.id);
    await this.collaboration.upsertRoom({
      id: rid,
      mode: "direct",
      coordinatorId: agent.id,
      roundLimit: 1,
      status: "active"
    });
    await this.collaboration.addRoomMessage({
      roomId: rid,
      round: 1,
      fromAgentId: "user",
      toAgentId: agent.id,
      role: "user",
      content: request.message
    });

    publishEvent(this.eventBus, {
      type: "system.info",
      detail: `Routing message to ${agent.id} in direct mode`
    });
    publishEvent(this.eventBus, {
      type: "agent.message",
      roomId: rid,
      fromAgentId: "user",
      toAgentId: agent.id,
      round: 1,
      contentPreview: summarize(request.message)
    });

    const result = await this.runSingleAgent({ ...request, roomId: rid }, agent);
    await this.collaboration.addRoomMessage({
      roomId: rid,
      round: 1,
      fromAgentId: agent.id,
      toAgentId: "user",
      role: "assistant",
      content: result.finalText
    });
    await this.collaboration.updateRoomStatus(rid, "completed");

    publishEvent(this.eventBus, {
      type: "agent.message",
      roomId: rid,
      fromAgentId: agent.id,
      toAgentId: "user",
      round: 1,
      contentPreview: summarize(result.finalText)
    });

    return result;
  }

  private async runDelegatedMode(request: AgentRunRequest) {
    const workspaceId = request.workspaceId ?? "default";
    const resolved = resolveDelegationObjective({
      parentAgentId: request.agentId,
      objective: request.message
    });

    let target = resolved.targetAgentId ? this.lifecycle.get(resolved.targetAgentId, workspaceId) : undefined;
    if (target?.status === "paused") {
      target = undefined;
    }
    if (!target) {
      target = this.lifecycle.listSubAgents(workspaceId).find((candidate) => candidate.status !== "paused");
    }
    if (!target) {
      target = await this.lifecycle.createSubAgent({
        label: "Worker Agent",
        workspaceId,
        parentId: "main"
      });
      publishEvent(this.eventBus, {
        type: "agent.lifecycle",
        agentId: target.id,
        action: "spawned",
        status: target.status,
        parentId: target.parentId
      });
      publishEvent(this.eventBus, {
        type: "agent.spawned",
        agentId: target.id,
        parentId: target.parentId,
        workspaceId
      });
    }

    const delegationId = randomUUID();
    await this.collaboration.createDelegationTask({
      id: delegationId,
      parentAgentId: request.agentId,
      targetAgentId: target.id,
      objective: resolved.rewrittenObjective,
      status: "running"
    });

    const rid = roomKey(request, request.agentId);
    await this.collaboration.upsertRoom({
      id: rid,
      mode: "delegated",
      coordinatorId: request.agentId,
      roundLimit: 1,
      status: "active"
    });
    await this.collaboration.addRoomMessage({
      roomId: rid,
      round: 1,
      fromAgentId: request.agentId,
      toAgentId: target.id,
      role: "user",
      content: resolved.rewrittenObjective
    });
    publishEvent(this.eventBus, {
      type: "agent.delegation",
      fromAgentId: request.agentId,
      toAgentId: target.id,
      objective: resolved.rewrittenObjective
    });
    publishEvent(this.eventBus, {
      type: "delegation.created",
      fromAgentId: request.agentId,
      toAgentId: target.id,
      objective: resolved.rewrittenObjective,
      roomId: rid
    });

    const delegatedResult = await this.runSingleAgent(
      {
        ...request,
        agentId: target.id,
        message: resolved.rewrittenObjective,
        mode: "direct",
        roomId: rid,
        workspaceId
      },
      target
    );

    await this.collaboration.addRoomMessage({
      roomId: rid,
      round: 1,
      fromAgentId: target.id,
      toAgentId: request.agentId,
      role: "assistant",
      content: delegatedResult.finalText
    });
    await this.collaboration.updateDelegationTask(delegationId, "completed", {
      finalText: delegatedResult.finalText,
      usage: delegatedResult.usage
    });
    await this.collaboration.updateRoomStatus(rid, "completed");
    publishEvent(this.eventBus, {
      type: "delegation.completed",
      fromAgentId: request.agentId,
      toAgentId: target.id,
      objective: resolved.rewrittenObjective,
      status: "completed",
      roomId: rid
    });

    return {
      finalText: `Delegated to ${target.id}:\n${delegatedResult.finalText}`,
      steps: delegatedResult.steps,
      usage: delegatedResult.usage
    };
  }

  private async runGroupMode(request: AgentRunRequest): Promise<AgentRunResult> {
    const workspaceId = request.workspaceId ?? "default";
    const participants = this.lifecycle
      .list(workspaceId)
      .filter((agent) => agent.status !== "busy" && agent.status !== "paused" && agent.status !== "error")
      .sort((a, b) => (a.id === "main" ? -1 : b.id === "main" ? 1 : a.createdAt.localeCompare(b.createdAt)));
    const coordinatorId =
      (request.coordinatorId && this.lifecycle.has(request.coordinatorId, workspaceId) && request.coordinatorId) ||
      (this.lifecycle.has(request.agentId, workspaceId) ? request.agentId : "main");
    const rid = roomKey(request, coordinatorId);
    const roundLimit = clamp(request.roundLimit ?? this.maxGroupRounds, 1, this.maxGroupRounds);

    await this.collaboration.upsertRoom({
      id: rid,
      mode: "group",
      coordinatorId,
      roundLimit,
      status: "active"
    });
    await this.collaboration.addRoomMessage({
      roomId: rid,
      round: 0,
      fromAgentId: "user",
      toAgentId: coordinatorId,
      role: "user",
      content: request.message
    });

    publishEvent(this.eventBus, {
      type: "group.turn",
      participantCount: participants.length,
      coordinatorId
    });

    const allSteps: RuntimeStep[] = [];
    const roundResults: AgentRoundResult[] = [];
    let usage: TokenUsage = emptyUsage();
    let synthesis = request.message;

    for (let round = 1; round <= roundLimit; round += 1) {
      publishEvent(this.eventBus, {
        type: "agent.round",
        roomId: rid,
        round,
        coordinatorId,
        status: "start"
      });

      const outputs: AgentRoundResult["outputs"] = [];
      for (const participant of participants) {
        const directive =
          round === 1
            ? request.message
            : `Round ${round}. Build on this synthesis:\n${synthesis}\nReturn concise actionable output.`;

        await this.collaboration.addRoomMessage({
          roomId: rid,
          round,
          fromAgentId: coordinatorId,
          toAgentId: participant.id,
          role: "user",
          content: directive
        });
        publishEvent(this.eventBus, {
          type: "agent.message",
          roomId: rid,
          fromAgentId: coordinatorId,
          toAgentId: participant.id,
          round,
          contentPreview: summarize(directive)
        });

        const result = await this.runSingleAgent(
          {
            ...request,
            agentId: participant.id,
            message: directive,
            mode: "direct",
            roomId: rid,
            workspaceId
          },
          participant
        );

        await this.collaboration.addRoomMessage({
          roomId: rid,
          round,
          fromAgentId: participant.id,
          toAgentId: coordinatorId,
          role: "assistant",
          content: result.finalText
        });
        publishEvent(this.eventBus, {
          type: "agent.message",
          roomId: rid,
          fromAgentId: participant.id,
          toAgentId: coordinatorId,
          round,
          contentPreview: summarize(result.finalText)
        });

        allSteps.push(...result.steps);
        usage = {
          inputTokens: usage.inputTokens + result.usage.inputTokens,
          outputTokens: usage.outputTokens + result.usage.outputTokens,
          estimatedCostUsd: Number((usage.estimatedCostUsd + result.usage.estimatedCostUsd).toFixed(6))
        };
        outputs.push({
          agentId: participant.id,
          summary: summarize(result.finalText),
          steps: result.steps,
          usage: result.usage
        });
      }

      roundResults.push({
        roomId: rid,
        round,
        coordinatorId,
        outputs
      });
      synthesis = outputs.map((output) => `[${output.agentId}] ${output.summary}`).join("\n");

      publishEvent(this.eventBus, {
        type: "agent.round",
        roomId: rid,
        round,
        coordinatorId,
        status: "complete"
      });

      if (round >= 2 && synthesis.length < 160) {
        break;
      }
    }

    await this.collaboration.updateRoomStatus(rid, "completed");
    const finalText = roundResults
      .map((roundResult) =>
        [
          `Round ${roundResult.round}`,
          ...roundResult.outputs.map((output) => `- [${output.agentId}] ${output.summary}`)
        ].join("\n")
      )
      .join("\n\n");

    return {
      finalText,
      steps: allSteps,
      usage
    };
  }
}
