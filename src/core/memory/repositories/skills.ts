import { SQLiteMemoryDB } from "@/src/core/memory/db";

export interface SkillRow {
  id: string;
  source_path: string;
  version: string;
  enabled: number;
  scope_default: "shared" | "isolated";
  prompt: string;
  created_at: string;
  updated_at: string;
}

export class SkillRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async upsertSkill(input: {
    id: string;
    sourcePath: string;
    version: string;
    enabled: boolean;
    scopeDefault: "shared" | "isolated";
    prompt: string;
  }) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO skill_registry (id, source_path, version, enabled, scope_default, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        source_path = excluded.source_path,
        version = excluded.version,
        enabled = excluded.enabled,
        scope_default = excluded.scope_default,
        prompt = excluded.prompt,
        updated_at = excluded.updated_at`,
      [
        input.id,
        input.sourcePath,
        input.version,
        input.enabled ? 1 : 0,
        input.scopeDefault,
        input.prompt,
        now,
        now
      ]
    );
  }

  async listSkills(includeDisabled = false) {
    return this.db.all<SkillRow>(
      `SELECT id, source_path, version, enabled, scope_default, prompt, created_at, updated_at
       FROM skill_registry
       ${includeDisabled ? "" : "WHERE enabled = 1"}
       ORDER BY id ASC`
    );
  }

  async getSkill(skillId: string) {
    return this.db.get<SkillRow>(
      `SELECT id, source_path, version, enabled, scope_default, prompt, created_at, updated_at
       FROM skill_registry
       WHERE id = ?`,
      [skillId]
    );
  }

  async bindSkill(input: {
    agentId: string;
    skillId: string;
    mode: "shared" | "isolated";
    isolatedCopyPath?: string;
  }) {
    await this.db.run(
      `DELETE FROM agent_skill_bindings
       WHERE agent_id = ? AND skill_id = ?`,
      [input.agentId, input.skillId]
    );
    await this.db.run(
      `INSERT INTO agent_skill_bindings (agent_id, skill_id, isolated_copy_path, mode, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.agentId,
        input.skillId,
        input.isolatedCopyPath ?? null,
        input.mode,
        new Date().toISOString()
      ]
    );
  }

  async clearBindings(agentId: string) {
    await this.db.run(`DELETE FROM agent_skill_bindings WHERE agent_id = ?`, [agentId]);
  }

  async removeBinding(agentId: string, skillId: string) {
    await this.db.run(
      `DELETE FROM agent_skill_bindings
       WHERE agent_id = ? AND skill_id = ?`,
      [agentId, skillId]
    );
  }

  async updateSkill(skillId: string, patch: { enabled?: boolean; version?: string; prompt?: string; scopeDefault?: "shared" | "isolated" }) {
    const found = await this.getSkill(skillId);
    if (!found) return undefined;
    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE skill_registry
       SET enabled = ?,
           version = ?,
           prompt = ?,
           scope_default = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        typeof patch.enabled === "boolean" ? (patch.enabled ? 1 : 0) : found.enabled,
        patch.version ?? found.version,
        patch.prompt ?? found.prompt,
        patch.scopeDefault ?? found.scope_default,
        now,
        skillId
      ]
    );
    return this.getSkill(skillId);
  }

  async listBindings(agentId?: string) {
    if (agentId) {
      return this.db.all<{
        id: number;
        agent_id: string;
        skill_id: string;
        isolated_copy_path: string | null;
        mode: "shared" | "isolated";
        created_at: string;
      }>(
        `SELECT id, agent_id, skill_id, isolated_copy_path, mode, created_at
         FROM agent_skill_bindings
         WHERE agent_id = ?
         ORDER BY id DESC`,
        [agentId]
      );
    }

    return this.db.all<{
      id: number;
      agent_id: string;
      skill_id: string;
      isolated_copy_path: string | null;
      mode: "shared" | "isolated";
      created_at: string;
    }>(
      `SELECT id, agent_id, skill_id, isolated_copy_path, mode, created_at
       FROM agent_skill_bindings
       ORDER BY id DESC`
    );
  }
}
