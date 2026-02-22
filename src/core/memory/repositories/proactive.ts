import { SQLiteMemoryDB } from "@/src/core/memory/db";

export type ProactiveTriggerType = "pattern" | "cron";

export class ProactiveRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async createRule(input: {
    id: string;
    name: string;
    triggerType: ProactiveTriggerType;
    cronExpr?: string;
    pattern?: Record<string, unknown>;
    enabled: boolean;
  }) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO proactive_rules (id, name, trigger_type, cron_expr, pattern_json, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.name,
        input.triggerType,
        input.cronExpr ?? null,
        input.pattern ? JSON.stringify(input.pattern) : null,
        input.enabled ? 1 : 0,
        now,
        now
      ]
    );
  }

  async listRules() {
    return this.db.all<{
      id: string;
      name: string;
      trigger_type: ProactiveTriggerType;
      cron_expr: string | null;
      pattern_json: string | null;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, trigger_type, cron_expr, pattern_json, enabled, created_at, updated_at
       FROM proactive_rules
       ORDER BY updated_at DESC`
    );
  }

  async findRuleByName(name: string) {
    return this.db.get<{
      id: string;
      name: string;
      trigger_type: ProactiveTriggerType;
      cron_expr: string | null;
      pattern_json: string | null;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, trigger_type, cron_expr, pattern_json, enabled, created_at, updated_at
       FROM proactive_rules
       WHERE name = ?
       LIMIT 1`,
      [name]
    );
  }

  async setRuleEnabled(ruleId: string, enabled: boolean) {
    await this.db.run(
      `UPDATE proactive_rules
       SET enabled = ?, updated_at = ?
       WHERE id = ?`,
      [enabled ? 1 : 0, new Date().toISOString(), ruleId]
    );
  }

  async deleteRule(ruleId: string) {
    await this.db.run(`DELETE FROM proactive_runs WHERE rule_id = ?`, [ruleId]);
    const result = await this.db.run(`DELETE FROM proactive_rules WHERE id = ?`, [ruleId]);
    return result.changes > 0;
  }

  async addRun(input: {
    id: string;
    ruleId: string;
    status: "queued" | "running" | "completed" | "failed";
    outputSummary?: string;
  }) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO proactive_runs (id, rule_id, status, output_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.ruleId, input.status, input.outputSummary ?? null, now, now]
    );
  }

  async updateRun(input: { id: string; status: "queued" | "running" | "completed" | "failed"; outputSummary?: string }) {
    await this.db.run(
      `UPDATE proactive_runs
       SET status = ?, output_summary = ?, updated_at = ?
       WHERE id = ?`,
      [input.status, input.outputSummary ?? null, new Date().toISOString(), input.id]
    );
  }

  async lastRunForRule(ruleId: string) {
    return this.db.get<{
      id: string;
      rule_id: string;
      status: "queued" | "running" | "completed" | "failed";
      output_summary: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, rule_id, status, output_summary, created_at, updated_at
       FROM proactive_runs
       WHERE rule_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [ruleId]
    );
  }

  async listRuns(limit = 120) {
    return this.db.all<{
      id: string;
      rule_id: string;
      status: "queued" | "running" | "completed" | "failed";
      output_summary: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, rule_id, status, output_summary, created_at, updated_at
       FROM proactive_runs
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}
