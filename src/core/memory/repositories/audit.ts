import { SQLiteMemoryDB } from "@/src/core/memory/db";

export class AuditRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async latestHash() {
    const row = await this.db.get<{ curr_hash: string }>(
      `SELECT curr_hash
       FROM audit_logs
       ORDER BY id DESC
       LIMIT 1`
    );
    return row?.curr_hash;
  }

  async addLog(input: {
    action: string;
    actorType: string;
    actorId?: string;
    targetPath: string;
    diffPath: string;
    summary: string;
    prevHash?: string;
    currHash: string;
  }) {
    await this.db.run(
      `INSERT INTO audit_logs (action, actor_type, actor_id, target_path, diff_path, summary, prev_hash, curr_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.action,
        input.actorType,
        input.actorId ?? null,
        input.targetPath,
        input.diffPath,
        input.summary,
        input.prevHash ?? null,
        input.currHash,
        new Date().toISOString()
      ]
    );
  }

  async listRecent(limit = 120) {
    return this.db.all<{
      id: number;
      action: string;
      actor_type: string;
      actor_id: string | null;
      target_path: string;
      diff_path: string;
      summary: string;
      prev_hash: string | null;
      curr_hash: string;
      created_at: string;
    }>(
      `SELECT id, action, actor_type, actor_id, target_path, diff_path, summary, prev_hash, curr_hash, created_at
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
  }
}

