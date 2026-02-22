import { randomUUID } from "node:crypto";
import { SQLiteMemoryDB } from "@/src/core/memory/db";

export type ConversationMode = "direct" | "delegated" | "group" | "hive";
export type ConversationRole = "user" | "assistant" | "agent" | "system";

export interface ConversationRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  mode: ConversationMode;
  title: string | null;
  created_at: number;
  updated_at: number;
  message_count: number;
  last_message_preview: string | null;
}

export interface ConversationMessageRecord {
  id: string;
  conversation_id: string;
  role: ConversationRole;
  agent_id: string | null;
  content: string;
  tool_calls: string | null;
  metadata: string | null;
  created_at: number;
}

function nowTs() {
  return Date.now();
}

function preview(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 180);
}

export class ConversationRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async list(input: {
    workspaceId: string;
    agentId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.max(1, Math.min(input.limit ?? 40, 200));
    const offset = Math.max(0, input.offset ?? 0);
    if (input.agentId) {
      return this.db.all<ConversationRecord>(
        `SELECT id, workspace_id, agent_id, mode, title, created_at, updated_at, message_count, last_message_preview
         FROM conversations
         WHERE workspace_id = ? AND agent_id = ?
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
        [input.workspaceId, input.agentId, limit, offset]
      );
    }
    return this.db.all<ConversationRecord>(
      `SELECT id, workspace_id, agent_id, mode, title, created_at, updated_at, message_count, last_message_preview
       FROM conversations
       WHERE workspace_id = ?
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [input.workspaceId, limit, offset]
    );
  }

  async get(conversationId: string) {
    return this.db.get<ConversationRecord>(
      `SELECT id, workspace_id, agent_id, mode, title, created_at, updated_at, message_count, last_message_preview
       FROM conversations
       WHERE id = ?`,
      [conversationId]
    );
  }

  async create(input: {
    workspaceId: string;
    agentId: string;
    mode: ConversationMode;
    title?: string;
    id?: string;
  }) {
    const id = input.id ?? randomUUID();
    const createdAt = nowTs();
    await this.db.run(
      `INSERT INTO conversations (id, workspace_id, agent_id, mode, title, created_at, updated_at, message_count, last_message_preview)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [id, input.workspaceId, input.agentId, input.mode, input.title?.trim() || null, createdAt, createdAt]
    );
    return this.get(id);
  }

  async updateTitle(conversationId: string, title: string | null) {
    await this.db.run(
      `UPDATE conversations
       SET title = ?, updated_at = ?
       WHERE id = ?`,
      [title?.trim() || null, nowTs(), conversationId]
    );
    return this.get(conversationId);
  }

  async delete(conversationId: string) {
    await this.db.run(`DELETE FROM conversation_messages WHERE conversation_id = ?`, [conversationId]);
    const result = await this.db.run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
    return result.changes > 0;
  }

  async addMessage(input: {
    conversationId: string;
    role: ConversationRole;
    agentId?: string | null;
    content: string;
    toolCalls?: unknown[];
    metadata?: Record<string, unknown>;
    id?: string;
  }) {
    const id = input.id ?? randomUUID();
    const createdAt = nowTs();
    await this.db.run(
      `INSERT INTO conversation_messages (id, conversation_id, role, agent_id, content, tool_calls, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.conversationId,
        input.role,
        input.agentId ?? null,
        input.content,
        input.toolCalls ? JSON.stringify(input.toolCalls) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt
      ]
    );
    await this.db.run(
      `UPDATE conversations
       SET updated_at = ?,
           message_count = message_count + 1,
           last_message_preview = ?
       WHERE id = ?`,
      [createdAt, preview(input.content), input.conversationId]
    );
    return this.db.get<ConversationMessageRecord>(
      `SELECT id, conversation_id, role, agent_id, content, tool_calls, metadata, created_at
       FROM conversation_messages
       WHERE id = ?`,
      [id]
    );
  }

  async listMessages(input: { conversationId: string; limit?: number; before?: number }) {
    const limit = Math.max(1, Math.min(input.limit ?? 120, 300));
    if (typeof input.before === "number" && Number.isFinite(input.before)) {
      return this.db.all<ConversationMessageRecord>(
        `SELECT id, conversation_id, role, agent_id, content, tool_calls, metadata, created_at
         FROM conversation_messages
         WHERE conversation_id = ? AND created_at < ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [input.conversationId, input.before, limit]
      );
    }
    return this.db.all<ConversationMessageRecord>(
      `SELECT id, conversation_id, role, agent_id, content, tool_calls, metadata, created_at
       FROM conversation_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [input.conversationId, limit]
    );
  }

  async searchMessages(input: { workspaceId: string; query: string; limit?: number }) {
    const limit = Math.max(1, Math.min(input.limit ?? 20, 80));
    const q = `%${input.query.toLowerCase()}%`;
    return this.db.all<
      ConversationMessageRecord & { conversation_workspace_id: string; conversation_agent_id: string }
    >(
      `SELECT m.id, m.conversation_id, m.role, m.agent_id, m.content, m.tool_calls, m.metadata, m.created_at,
              c.workspace_id AS conversation_workspace_id,
              c.agent_id AS conversation_agent_id
       FROM conversation_messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.workspace_id = ?
         AND LOWER(m.content) LIKE ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [input.workspaceId, q, limit]
    );
  }
}

