import type { ProviderId } from "@/src/core/providers/types";

export type AgentMode = "direct" | "delegated" | "group" | "hive";

export type ForgeStage =
  | "analyze"
  | "research"
  | "generate"
  | "sandbox-test"
  | "formalize"
  | "register"
  | "logged";

export type ForgeStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed" | "rejected";

export type CallState = "queued" | "ringing" | "in-progress" | "handoff" | "completed" | "failed";

export interface Attachment {
  name: string;
  type: string;
  content?: string; // Base64 or text
  uri?: string;    // Path to local file or remote URL
}

export interface AgentDescriptor {
  id: string;
  label: string;
  workspaceId: string;
  status: "active" | "idle" | "busy" | "paused" | "error";
  type: "main" | "sub-agent";
  parentId?: string;
  isolateShortTermMemory: boolean;
  isolateLongTermMemory: boolean;
  isolateTools: boolean;
  autonomousSpawning: boolean;
  systemPromptOverride?: string;
  soulOverride?: string;
  provider?: ProviderId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enabledTools?: string[];
  enabledSkills?: string[];
  voiceId?: string;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunRequest {
  agentId: string;
  message: string;
  mode: AgentMode;
  chatId?: string;
  source?: "ui" | "telegram";
  memoryNamespace?: string;
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
  attachments?: Attachment[];
}

export interface RuntimeStep {
  iteration: number;
  phase: "reasoning" | "tool" | "reflection" | "final";
  detail: string;
  toolId?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AgentRunResult {
  finalText: string;
  steps: RuntimeStep[];
  usage: TokenUsage;
  artifacts?: Attachment[];
}

export interface ForgeJobSummary {
  id: string;
  trigger: "task-failure" | "missing-capability" | "manual";
  agentId: string;
  capability: string;
  stage: ForgeStage;
  status: ForgeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRoundResult {
  roomId: string;
  round: number;
  coordinatorId: string;
  outputs: Array<{ agentId: string; summary: string; steps: RuntimeStep[]; usage: TokenUsage }>;
}

export interface CallSessionSummary {
  id: string;
  sid?: string;
  provider: "twilio";
  controllingAgentId: string;
  state: CallState;
  toNumber: string;
  startedAt: string;
  updatedAt: string;
}

export interface HiveDescriptor {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SwarmMember {
  hiveId: string;
  agentId: string;
  role: string;
  joinedAt: number;
}

export interface LiveFeedEvent {
  id: string;
  workspaceId: string;
  hiveId?: string;
  eventType: string;
  actorId?: string;
  actorType?: string;
  content: string;
  metadata?: string;
  createdAt: number;
}

export interface SystemEventBase {
  timestamp: string;
  eventId?: string;
}

export type SystemEvent =
  | (SystemEventBase & { type: "agent.step.started"; agentId: string; step: string; iteration: number })
  | (SystemEventBase & { type: "agent.step.completed"; agentId: string; step: string; iteration: number; detail?: string })
  | (SystemEventBase & { type: "agent.spawned"; agentId: string; parentId?: string; workspaceId?: string })
  | (SystemEventBase & { type: "agent.status.changed"; agentId: string; status: string; parentId?: string; workspaceId?: string })
  | (SystemEventBase & {
      type: "agent.stream.delta";
      streamId: string;
      roomId?: string;
      agentId: string;
      chunk: string;
      chunkIndex: number;
      done?: boolean;
    })
  | (SystemEventBase & {
      type: "agent.stream.completed";
      streamId: string;
      roomId?: string;
      agentId: string;
      finalText: string;
      steps?: RuntimeStep[];
      usage?: TokenUsage;
    })
  | (SystemEventBase & { type: "tool.called"; agentId: string; toolId: string; risk?: string; inputPreview?: string })
  | (SystemEventBase & { type: "tool.completed"; agentId: string; toolId: string; risk?: string; status: string; detail?: string })
  | (SystemEventBase & { type: "delegation.created"; fromAgentId: string; toAgentId: string; objective: string; roomId?: string })
  | (SystemEventBase & {
      type: "delegation.completed";
      fromAgentId: string;
      toAgentId: string;
      objective: string;
      status: "completed" | "failed";
      roomId?: string;
    })
  | (SystemEventBase & { type: "forge.stage.changed"; jobId: string; stage: ForgeStage; status: ForgeStatus; capability: string; agentId: string })
  | (SystemEventBase & {
      type: "provider.usage.updated";
      agentId: string;
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    })
  | (SystemEventBase & {
      type: "provider.config.changed";
      provider: ProviderId;
      model: string;
      failoverEnabled: boolean;
    })
  | (SystemEventBase & {
      type: "settings.updated";
      keys: string[];
    })
  | (SystemEventBase & { type: "agent.step"; agentId: string; detail: string; iteration: number })
  | (SystemEventBase & { type: "tool.invoked"; agentId: string; toolId: string; risk: string })
  | (SystemEventBase & { type: "memory.read"; agentId: string; namespace: string; count: number })
  | (SystemEventBase & { type: "memory.write"; agentId: string; namespace: string; kind: string })
  | (SystemEventBase & { type: "agent.lifecycle"; agentId: string; action: "spawned" | "status"; parentId?: string; status: string })
  | (SystemEventBase & { type: "agent.delegation"; fromAgentId: string; toAgentId: string; objective: string })
  | (SystemEventBase & { type: "group.turn"; participantCount: number; coordinatorId: string })
  | (SystemEventBase & { type: "agent.round"; roomId: string; round: number; coordinatorId: string; status: "start" | "complete" })
  | (SystemEventBase & { type: "agent.message"; roomId: string; fromAgentId: string; toAgentId: string; round: number; contentPreview: string })
  | (SystemEventBase & { type: "forge.job"; jobId: string; stage: ForgeStage; status: ForgeStatus; capability: string; agentId: string })
  | (SystemEventBase & { type: "forge.approval"; jobId: string; action: "requested" | "approved" | "rejected" })
  | (SystemEventBase & { type: "audit.log"; action: string; target: string; diffPath: string; actorAgentId?: string })
  | (SystemEventBase & { type: "call.session"; callId: string; state: CallState; controllingAgentId: string; sid?: string })
  | (SystemEventBase & { type: "call.handoff"; callId: string; fromAgentId: string; toAgentId: string })
  | (SystemEventBase & {
      type: "mission.task";
      action: "created" | "updated" | "deleted" | "approved";
      taskId: string;
      workspaceId: string;
      status?: string;
      assignedAgentId?: string;
    })
  | (SystemEventBase & {
      type: "mission.task.event";
      taskId: string;
      eventType: string;
      workspaceId: string;
      agentId?: string;
      content?: string;
    })
  | (SystemEventBase & { type: "proactive.task"; taskId: string; trigger: string; status: string })
  | (SystemEventBase & {
      type: "provider.usage";
      agentId: string;
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    })
  | (SystemEventBase & { type: "forge.event"; status: string; detail: string })
  | (SystemEventBase & {
      type: "provider.failover";
      fromProvider: ProviderId;
      toProvider: ProviderId;
      fromModel: string;
      toModel: string;
      reason: string;
    })
  | (SystemEventBase & { type: "heartbeat.tick"; pendingMessages: number; overdueTasks: number; flaggedMemory: number })
  | (SystemEventBase & { type: "recommendation.new"; category: string; title: string; detail: string; confidence: number })
  | (SystemEventBase & { type: "mesh.started"; meshId: string; goal: string; subtaskCount: number })
  | (SystemEventBase & { type: "mesh.subtask.assigned"; meshId: string; subtaskId: string; agentId: string; objective: string })
  | (SystemEventBase & { type: "mesh.subtask.completed"; meshId: string; subtaskId: string; agentId: string; status: "completed" | "failed" })
  | (SystemEventBase & { type: "mesh.completed"; meshId: string; status: "completed" | "failed"; summary: string })
  | (SystemEventBase & { type: "hive.created"; hiveId: string; workspaceId: string; name: string })
  | (SystemEventBase & { type: "swarm.member.joined"; hiveId: string; agentId: string; role: string })
  | (SystemEventBase & { type: "live_feed.event"; eventId: string; workspaceId: string; content: string; eventType: string })
  | (SystemEventBase & { type: "voice.started"; agentId: string; text: string; voiceId?: string })
  | (SystemEventBase & { type: "voice.finished"; agentId: string; durationMs?: number })
  | (SystemEventBase & { type: "transcription.completed"; agentId: string; text: string })
  | (SystemEventBase & { type: "system.info"; detail: string });

export interface ToolExecutionContext {
  agentId: string;
  workspaceId: string;
  requireConfirmation: boolean;
  confirmed: boolean;
}

export interface ToolDefinition<I, O> {
  id: string;
  description: string;
  risk: "safe" | "elevated" | "dangerous";
  execute(input: I, ctx: ToolExecutionContext): Promise<O>;
}
