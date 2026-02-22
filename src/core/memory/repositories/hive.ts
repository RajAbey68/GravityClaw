import { randomUUID } from "node:crypto";
import { SQLiteMemoryDB } from "@/src/core/memory/db";
import type { HiveDescriptor, SwarmMember, LiveFeedEvent, AgentDescriptor } from "@/src/core/types";

export class HiveRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async createHive(workspaceId: string, name: string, description?: string): Promise<HiveDescriptor> {
    const id = randomUUID();
    const now = Date.now();
    await this.db.run(
      `INSERT INTO hives (id, workspace_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, workspaceId, name, description ?? null, now, now]
    );
    return { id, workspaceId, name, description, createdAt: now, updatedAt: now };
  }

  async getHive(hiveId: string): Promise<HiveDescriptor | undefined> {
    const row = await this.db.get<any>(
      `SELECT * FROM hives WHERE id = ?`,
      [hiveId]
    );
    if (!row) return undefined;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listHives(workspaceId: string): Promise<HiveDescriptor[]> {
    const rows = await this.db.all<any>(
      `SELECT * FROM hives WHERE workspace_id = ? ORDER BY created_at DESC`,
      [workspaceId]
    );
    return rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async addSwarmMember(hiveId: string, agentId: string, role = 'worker'): Promise<SwarmMember> {
    const now = Date.now();
    await this.db.run(
      `INSERT INTO swarm_members (hive_id, agent_id, role, joined_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(hive_id, agent_id) DO UPDATE SET role = excluded.role`,
      [hiveId, agentId, role, now]
    );
    return { hiveId, agentId, role, joinedAt: now };
  }

  async listSwarmMembers(hiveId: string): Promise<SwarmMember[]> {
    const rows = await this.db.all<any>(
      `SELECT * FROM swarm_members WHERE hive_id = ?`,
      [hiveId]
    );
    return rows.map(row => ({
      hiveId: row.hive_id,
      agentId: row.agent_id,
      role: row.role,
      joinedAt: row.joined_at
    }));
  }

  async recordLiveFeedEvent(event: Omit<LiveFeedEvent, 'id' | 'createdAt'>): Promise<LiveFeedEvent> {
    const id = randomUUID();
    const now = Date.now();
    await this.db.run(
      `INSERT INTO live_feed_events (id, workspace_id, hive_id, event_type, actor_id, actor_type, content, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event.workspaceId,
        event.hiveId ?? null,
        event.eventType,
        event.actorId ?? null,
        event.actorType ?? null,
        event.content,
        event.metadata ?? null,
        now
      ]
    );
    return { ...event, id, createdAt: now };
  }

  async getLiveFeed(workspaceId: string, limit = 50): Promise<LiveFeedEvent[]> {
    const rows = await this.db.all<any>(
      `SELECT * FROM live_feed_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
      [workspaceId, limit]
    );
    return rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      hiveId: row.hive_id ?? undefined,
      eventType: row.event_type,
      actorId: row.actor_id ?? undefined,
      actorType: row.actor_type ?? undefined,
      content: row.content,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at
    }));
  }

  async upsertAgent(agent: AgentDescriptor): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO agents (
        id, workspace_id, label, type, status, parent_id, 
        isolate_short_term_memory, isolate_long_term_memory, isolate_tools, autonomous_spawning,
        voice_id, voice_stability, voice_similarity_boost, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        type = excluded.type,
        status = excluded.status,
        parent_id = excluded.parent_id,
        isolate_short_term_memory = excluded.isolate_short_term_memory,
        isolate_long_term_memory = excluded.isolate_long_term_memory,
        isolate_tools = excluded.isolate_tools,
        autonomous_spawning = excluded.autonomous_spawning,
        voice_id = excluded.voice_id,
        voice_stability = excluded.voice_stability,
        voice_similarity_boost = excluded.voice_similarity_boost,
        updated_at = excluded.updated_at`,
      [
        agent.id,
        agent.workspaceId,
        agent.label,
        agent.type,
        agent.status,
        agent.parentId ?? null,
        agent.isolateShortTermMemory ? 1 : 0,
        agent.isolateLongTermMemory ? 1 : 0,
        agent.isolateTools ? 1 : 0,
        agent.autonomousSpawning ? 1 : 0,
        agent.voiceId ?? null,
        agent.voiceStability ?? null,
        agent.voiceSimilarityBoost ?? null,
        agent.createdAt || now,
        now
      ]
    );
  }

  async getAgent(agentId: string): Promise<AgentDescriptor | undefined> {
    const row = await this.db.get<any>(
      `SELECT * FROM agents WHERE id = ?`,
      [agentId]
    );
    if (!row) return undefined;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      label: row.label,
      type: row.type as any,
      status: row.status as any,
      parentId: row.parent_id ?? undefined,
      isolateShortTermMemory: !!row.isolate_short_term_memory,
      isolateLongTermMemory: !!row.isolate_long_term_memory,
      isolateTools: !!row.isolate_tools,
      autonomousSpawning: !!row.autonomous_spawning,
      voiceId: row.voice_id ?? undefined,
      voiceStability: row.voice_stability ?? undefined,
      voiceSimilarityBoost: row.voice_similarity_boost ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateAgentVoice(agentId: string, voiceId: string, stability?: number, boost?: number): Promise<void> {
    await this.db.run(
      `UPDATE agents SET voice_id = ?, voice_stability = ?, voice_similarity_boost = ?, updated_at = ? WHERE id = ?`,
      [voiceId, stability ?? 0.5, boost ?? 0.75, new Date().toISOString(), agentId]
    );
  }

  async countOverdueTasks(workspaceId: string): Promise<number> {
    const row = await this.db.get<any>(
      `SELECT COUNT(*) as count FROM mission_tasks 
       WHERE workspace_id = ? AND status IN ('todo', 'in-progress') AND deadline < ?`,
      [workspaceId, new Date().toISOString()]
    );
    return row?.count ?? 0;
  }

  async countPendingMessages(workspaceId: string): Promise<number> {
    const row = await this.db.get<any>(
      `SELECT COUNT(*) as count FROM messages 
       WHERE workspace_id = ? AND status = 'pending'`,
      [workspaceId]
    );
    return row?.count ?? 0;
  }
}
