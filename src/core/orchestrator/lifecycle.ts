import type { AgentDescriptor } from "@/src/core/types";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";

interface CreateSubAgentInput {
  id?: string;
  label: string;
  workspaceId: string;
  parentId?: string;
  isolateShortTermMemory?: boolean;
  isolateLongTermMemory?: boolean;
  isolateTools?: boolean;
  autonomousSpawning?: boolean;
}

const REGISTRY_KEY = "agents.registry";

function scopedKey(workspaceId: string, agentId: string) {
  return `${workspaceId}:${agentId}`;
}

function slugifyId(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `agent-${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function baseMainAgent(workspaceId: string): AgentDescriptor {
  return {
    id: "main",
    label: "Main Agent",
    workspaceId,
    status: "active",
    type: "main",
    isolateShortTermMemory: false,
    isolateLongTermMemory: false,
    isolateTools: false,
    autonomousSpawning: true,
    temperature: 0.2,
    maxTokens: 650,
    createdAt: now(),
    updatedAt: now()
  };
}

function normalizeAgent(agent: AgentDescriptor): AgentDescriptor {
  return {
    ...agent,
    workspaceId: agent.workspaceId || "default",
    status: agent.status || "idle",
    isolateTools: agent.isolateTools ?? false,
    autonomousSpawning: agent.autonomousSpawning ?? true,
    temperature: agent.temperature ?? 0.2,
    maxTokens: agent.maxTokens ?? 650,
    enabledTools: agent.enabledTools ?? [],
    enabledSkills: agent.enabledSkills ?? []
  };
}

export class AgentLifecycle {
  private readonly agents = new Map<string, AgentDescriptor>();

  constructor(private readonly memories: MemoryRepository) {}

  async init() {
    const existing = await this.memories.getSetting(REGISTRY_KEY);
    if (!existing) {
      const root = baseMainAgent("default");
      this.agents.set(scopedKey("default", root.id), root);
      await this.persist();
      return;
    }

    try {
      const parsed = JSON.parse(existing) as AgentDescriptor[];
      parsed.forEach((agent) => {
        const normalized = normalizeAgent(agent);
        this.agents.set(scopedKey(normalized.workspaceId, normalized.id), normalized);
      });
    } catch {
      this.agents.clear();
      const root = baseMainAgent("default");
      this.agents.set(scopedKey("default", root.id), root);
      await this.persist();
    }

    await this.ensureWorkspace("default");
  }

  async ensureWorkspace(workspaceId: string) {
    if (this.get("main", workspaceId)) {
      return;
    }
    const root = baseMainAgent(workspaceId);
    this.agents.set(scopedKey(workspaceId, root.id), root);
    await this.persist();
  }

  list(workspaceId = "default") {
    return [...this.agents.values()]
      .filter((agent) => agent.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listAll() {
    return [...this.agents.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listSubAgents(workspaceId = "default") {
    return this.list(workspaceId).filter((agent) => agent.type === "sub-agent");
  }

  has(agentId: string, workspaceId = "default") {
    return this.agents.has(scopedKey(workspaceId, agentId));
  }

  get(agentId: string, workspaceId = "default") {
    return this.agents.get(scopedKey(workspaceId, agentId));
  }

  async createSubAgent(input: CreateSubAgentInput) {
    const id = input.id ? slugifyId(input.id) : slugifyId(input.label);
    const key = scopedKey(input.workspaceId, id);
    if (this.agents.has(key)) {
      throw new Error(`Agent '${id}' already exists in workspace '${input.workspaceId}'.`);
    }

    const descriptor: AgentDescriptor = {
      id,
      label: input.label,
      workspaceId: input.workspaceId,
      type: "sub-agent",
      status: "idle",
      parentId: input.parentId ?? "main",
      isolateShortTermMemory: input.isolateShortTermMemory ?? true,
      isolateLongTermMemory: input.isolateLongTermMemory ?? false,
      isolateTools: input.isolateTools ?? false,
      autonomousSpawning: input.autonomousSpawning ?? true,
      temperature: 0.2,
      maxTokens: 650,
      enabledTools: [],
      enabledSkills: [],
      createdAt: now(),
      updatedAt: now()
    };

    this.agents.set(key, descriptor);
    await this.persist();
    return descriptor;
  }

  async updateStatus(agentId: string, status: AgentDescriptor["status"], workspaceId = "default") {
    const found = this.agents.get(scopedKey(workspaceId, agentId));
    if (!found) {
      return undefined;
    }

    found.status = status;
    found.updatedAt = now();
    this.agents.set(scopedKey(workspaceId, agentId), found);
    await this.persist();
    return found;
  }

  async updateAgent(
    agentId: string,
    workspaceId: string,
    patch: Partial<
      Pick<
        AgentDescriptor,
        | "label"
        | "systemPromptOverride"
        | "soulOverride"
        | "provider"
        | "model"
        | "temperature"
        | "maxTokens"
        | "autonomousSpawning"
        | "isolateShortTermMemory"
        | "isolateLongTermMemory"
        | "isolateTools"
        | "enabledTools"
        | "enabledSkills"
        | "status"
      >
    >
  ) {
    const found = this.get(agentId, workspaceId);
    if (!found) {
      return undefined;
    }

    const next: AgentDescriptor = {
      ...found,
      ...patch,
      updatedAt: now()
    };
    this.agents.set(scopedKey(workspaceId, agentId), next);
    await this.persist();
    return next;
  }

  async cloneWorkspaceAgents(sourceWorkspaceId: string, targetWorkspaceId: string) {
    const sourceAgents = this.list(sourceWorkspaceId);
    await this.ensureWorkspace(targetWorkspaceId);
    for (const source of sourceAgents) {
      if (source.id === "main") {
        continue;
      }
      const candidateId = this.has(source.id, targetWorkspaceId)
        ? `${source.id}-${Math.random().toString(36).slice(2, 5)}`
        : source.id;
      await this.createSubAgent({
        id: candidateId,
        label: source.label,
        workspaceId: targetWorkspaceId,
        parentId: source.parentId,
        isolateShortTermMemory: source.isolateShortTermMemory,
        isolateLongTermMemory: source.isolateLongTermMemory,
        isolateTools: source.isolateTools,
        autonomousSpawning: source.autonomousSpawning
      });
      await this.updateAgent(candidateId, targetWorkspaceId, {
        systemPromptOverride: source.systemPromptOverride,
        soulOverride: source.soulOverride,
        provider: source.provider,
        model: source.model,
        temperature: source.temperature,
        maxTokens: source.maxTokens,
        enabledTools: source.enabledTools,
        enabledSkills: source.enabledSkills
      });
    }
  }

  async deleteWorkspaceAgents(workspaceId: string) {
    const keys = [...this.agents.keys()].filter((key) => key.startsWith(`${workspaceId}:`));
    keys.forEach((key) => this.agents.delete(key));
    await this.persist();
  }

  async removeAgent(agentId: string, workspaceId = "default") {
    if (agentId === "main") {
      throw new Error("main agent cannot be deleted");
    }
    const key = scopedKey(workspaceId, agentId);
    if (!this.agents.has(key)) {
      return false;
    }
    this.agents.delete(key);
    await this.persist();
    return true;
  }

  async touch(agentId: string, workspaceId = "default") {
    const found = this.get(agentId, workspaceId);
    if (!found) {
      return;
    }
    found.updatedAt = now();
    this.agents.set(scopedKey(workspaceId, agentId), found);
    await this.persist();
  }

  private async persist() {
    await this.memories.setSetting(REGISTRY_KEY, JSON.stringify(this.listAll()));
  }
}
