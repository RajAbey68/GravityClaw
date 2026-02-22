import { SQLiteMemoryDB } from "@/src/core/memory/db";

export class SessionRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async ensure(sessionKey: string, agentId: string, source: string) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT OR IGNORE INTO sessions (session_key, agent_id, source, created_at)
       VALUES (?, ?, ?, ?)`,
      [sessionKey, agentId, source, now]
    );
  }

  async addMessage(sessionKey: string, role: "user" | "assistant" | "system", content: string) {
    await this.db.run(
      `INSERT INTO messages (session_key, role, content, created_at)
       VALUES (?, ?, ?, ?)`,
      [sessionKey, role, content, new Date().toISOString()]
    );
  }

  async recentMessages(sessionKey: string, limit = 12) {
    return this.db.all<{ role: string; content: string; created_at: string }>(
      `SELECT role, content, created_at FROM messages
       WHERE session_key = ?
       ORDER BY id DESC
       LIMIT ?`,
      [sessionKey, limit]
    );
  }

  async recentGlobalMessages(limit = 400) {
    return this.db.all<{
      session_key: string;
      role: string;
      content: string;
      created_at: string;
    }>(
      `SELECT session_key, role, content, created_at
       FROM messages
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
  }

  async countMessagesContaining(term: string, limit = 400) {
    const escaped = `%${term.toLowerCase()}%`;
    const row = await this.db.get<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT content
         FROM messages
         ORDER BY id DESC
         LIMIT ?
       ) m
       WHERE lower(m.content) LIKE ?`,
      [limit, escaped]
    );
    return row?.total ?? 0;
  }
}
