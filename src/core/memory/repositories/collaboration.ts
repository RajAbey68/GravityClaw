import { SQLiteMemoryDB } from "@/src/core/memory/db";
import type { AgentMode } from "@/src/core/types";

export class CollaborationRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async upsertRoom(input: {
    id: string;
    mode: AgentMode;
    coordinatorId: string;
    roundLimit: number;
    status: "active" | "completed" | "failed";
  }) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO agent_rooms (id, mode, coordinator_id, round_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        coordinator_id = excluded.coordinator_id,
        round_limit = excluded.round_limit,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [input.id, input.mode, input.coordinatorId, input.roundLimit, input.status, now, now]
    );
  }

  async updateRoomStatus(id: string, status: "active" | "completed" | "failed") {
    await this.db.run(
      `UPDATE agent_rooms
       SET status = ?, updated_at = ?
       WHERE id = ?`,
      [status, new Date().toISOString(), id]
    );
  }

  async listRooms(limit = 80) {
    return this.db.all<{
      id: string;
      mode: AgentMode;
      coordinator_id: string;
      round_limit: number;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, mode, coordinator_id, round_limit, status, created_at, updated_at
       FROM agent_rooms
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  async activeRooms(limit = 40) {
    return this.db.all<{
      id: string;
      mode: AgentMode;
      coordinator_id: string;
      round_limit: number;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, mode, coordinator_id, round_limit, status, created_at, updated_at
       FROM agent_rooms
       WHERE status = 'active'
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  async addRoomMessage(input: {
    roomId: string;
    round: number;
    fromAgentId: string;
    toAgentId: string;
    role: "user" | "assistant" | "system";
    content: string;
  }) {
    await this.db.run(
      `INSERT INTO agent_messages (room_id, round, from_agent_id, to_agent_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.roomId,
        input.round,
        input.fromAgentId,
        input.toAgentId,
        input.role,
        input.content,
        new Date().toISOString()
      ]
    );
  }

  async recentRoomMessages(roomId: string, limit = 60) {
    return this.db.all<{
      id: number;
      room_id: string;
      round: number;
      from_agent_id: string;
      to_agent_id: string;
      role: string;
      content: string;
      created_at: string;
    }>(
      `SELECT id, room_id, round, from_agent_id, to_agent_id, role, content, created_at
       FROM agent_messages
       WHERE room_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [roomId, limit]
    );
  }

  async createDelegationTask(input: {
    id: string;
    parentAgentId: string;
    targetAgentId: string;
    objective: string;
    status: "queued" | "running" | "completed" | "failed";
    resultJson?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO delegation_tasks (id, parent_agent_id, target_agent_id, objective, status, result_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.parentAgentId,
        input.targetAgentId,
        input.objective,
        input.status,
        input.resultJson ? JSON.stringify(input.resultJson) : null,
        now,
        now
      ]
    );
  }

  async updateDelegationTask(
    id: string,
    status: "queued" | "running" | "completed" | "failed",
    resultJson?: Record<string, unknown>
  ) {
    await this.db.run(
      `UPDATE delegation_tasks
       SET status = ?, result_json = ?, updated_at = ?
       WHERE id = ?`,
      [status, resultJson ? JSON.stringify(resultJson) : null, new Date().toISOString(), id]
    );
  }

  async recentDelegations(limit = 80) {
    return this.db.all<{
      id: string;
      parent_agent_id: string;
      target_agent_id: string;
      objective: string;
      status: string;
      result_json: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, parent_agent_id, target_agent_id, objective, status, result_json, created_at, updated_at
       FROM delegation_tasks
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}

