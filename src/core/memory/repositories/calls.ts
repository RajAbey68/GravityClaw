import { SQLiteMemoryDB } from "@/src/core/memory/db";
import type { CallSessionSummary, CallState } from "@/src/core/types";

function mapCall(row: {
  id: string;
  sid: string | null;
  controlling_agent_id: string;
  state: CallState;
  to_number: string;
  created_at: string;
  updated_at: string;
}): CallSessionSummary {
  return {
    id: row.id,
    sid: row.sid ?? undefined,
    provider: "twilio",
    controllingAgentId: row.controlling_agent_id,
    state: row.state,
    toNumber: row.to_number,
    startedAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class CallRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async createSession(input: {
    id: string;
    provider: "twilio";
    sid?: string;
    controllingAgentId: string;
    toNumber: string;
    fromNumber?: string;
    state: CallState;
    context?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO call_sessions (id, provider, sid, controlling_agent_id, to_number, from_number, state, context_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.provider,
        input.sid ?? null,
        input.controllingAgentId,
        input.toNumber,
        input.fromNumber ?? null,
        input.state,
        input.context ? JSON.stringify(input.context) : null,
        now,
        now
      ]
    );
  }

  async updateSession(input: {
    id: string;
    sid?: string;
    controllingAgentId?: string;
    state?: CallState;
    context?: Record<string, unknown>;
  }) {
    const current = await this.getById(input.id);
    if (!current) {
      return;
    }

    await this.db.run(
      `UPDATE call_sessions
       SET sid = ?,
           controlling_agent_id = ?,
           state = ?,
           context_json = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        input.sid ?? current.sid ?? null,
        input.controllingAgentId ?? current.controllingAgentId,
        input.state ?? current.state,
        input.context ? JSON.stringify(input.context) : JSON.stringify(current.context ?? {}),
        new Date().toISOString(),
        input.id
      ]
    );
  }

  async getById(id: string) {
    const row = await this.db.get<{
      id: string;
      provider: "twilio";
      sid: string | null;
      controlling_agent_id: string;
      to_number: string;
      from_number: string | null;
      state: CallState;
      context_json: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, provider, sid, controlling_agent_id, to_number, from_number, state, context_json, created_at, updated_at
       FROM call_sessions
       WHERE id = ?`,
      [id]
    );
    if (!row) return undefined;
    return {
      ...mapCall(row),
      fromNumber: row.from_number ?? undefined,
      context: row.context_json ? (JSON.parse(row.context_json) as Record<string, unknown>) : {}
    };
  }

  async getBySid(sid: string) {
    const row = await this.db.get<{
      id: string;
      provider: "twilio";
      sid: string | null;
      controlling_agent_id: string;
      to_number: string;
      from_number: string | null;
      state: CallState;
      context_json: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, provider, sid, controlling_agent_id, to_number, from_number, state, context_json, created_at, updated_at
       FROM call_sessions
       WHERE sid = ?`,
      [sid]
    );
    if (!row) return undefined;
    return {
      ...mapCall(row),
      fromNumber: row.from_number ?? undefined,
      context: row.context_json ? (JSON.parse(row.context_json) as Record<string, unknown>) : {}
    };
  }

  async listSessions(limit = 80) {
    const rows = await this.db.all<{
      id: string;
      sid: string | null;
      controlling_agent_id: string;
      state: CallState;
      to_number: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, sid, controlling_agent_id, state, to_number, created_at, updated_at
       FROM call_sessions
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(mapCall);
  }

  async addEvent(callSessionId: string, eventType: string, payload?: Record<string, unknown>) {
    await this.db.run(
      `INSERT INTO call_events (call_session_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [callSessionId, eventType, payload ? JSON.stringify(payload) : null, new Date().toISOString()]
    );
  }

  async listEvents(callSessionId: string, limit = 120) {
    return this.db.all<{
      id: number;
      call_session_id: string;
      event_type: string;
      payload_json: string | null;
      created_at: string;
    }>(
      `SELECT id, call_session_id, event_type, payload_json, created_at
       FROM call_events
       WHERE call_session_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [callSessionId, limit]
    );
  }
}

