import { SQLiteMemoryDB } from "@/src/core/memory/db";
import type { RuntimeStep, TokenUsage } from "@/src/core/types";

export class EventRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async addRuntimeSteps(sessionKey: string, steps: RuntimeStep[]) {
    for (const step of steps) {
      await this.db.run(
        `INSERT INTO runtime_steps (session_key, iteration, phase, detail, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionKey, step.iteration, step.phase, step.detail, new Date().toISOString()]
      );
    }
  }

  async addToolEvent(sessionKey: string, toolId: string, risk: string, status: string, detail: string) {
    await this.db.run(
      `INSERT INTO tool_events (session_key, tool_id, risk, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionKey, toolId, risk, status, detail, new Date().toISOString()]
    );
  }

  async addProviderUsage(sessionKey: string, provider: string, model: string, usage: TokenUsage) {
    await this.db.run(
      `INSERT INTO provider_usage (session_key, provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionKey,
        provider,
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.estimatedCostUsd,
        new Date().toISOString()
      ]
    );
  }

  async recentEvents(limit = 100) {
    return this.db.all<{
      id: number;
      tool_id: string;
      status: string;
      created_at: string;
      detail: string;
    }>(
      `SELECT id, tool_id, status, created_at, detail
       FROM tool_events
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
  }

  async toolUsageCounts(limit = 100) {
    return this.db.all<{ tool_id: string; total: number }>(
      `SELECT tool_id, COUNT(*) AS total
       FROM tool_events
       GROUP BY tool_id
       ORDER BY total DESC
       LIMIT ?`,
      [limit]
    );
  }

  async recentToolEvents(limit = 120, toolId?: string) {
    if (toolId) {
      return this.db.all<{
        id: number;
        session_key: string;
        tool_id: string;
        risk: string;
        status: string;
        detail: string | null;
        created_at: string;
      }>(
        `SELECT id, session_key, tool_id, risk, status, detail, created_at
         FROM tool_events
         WHERE tool_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [toolId, limit]
      );
    }

    return this.db.all<{
      id: number;
      session_key: string;
      tool_id: string;
      risk: string;
      status: string;
      detail: string | null;
      created_at: string;
    }>(
      `SELECT id, session_key, tool_id, risk, status, detail, created_at
       FROM tool_events
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
  }

  async providerUsageTotals() {
    const row = await this.db.get<{
      input_tokens: number;
      output_tokens: number;
      estimated_cost_usd: number;
      requests: number;
    }>(
      `SELECT
         COALESCE(SUM(input_tokens), 0) AS input_tokens,
         COALESCE(SUM(output_tokens), 0) AS output_tokens,
         COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
         COUNT(*) AS requests
       FROM provider_usage`
    );

    return {
      inputTokens: row?.input_tokens ?? 0,
      outputTokens: row?.output_tokens ?? 0,
      estimatedCostUsd: Number((row?.estimated_cost_usd ?? 0).toFixed(6)),
      requests: row?.requests ?? 0
    };
  }

  async memoryReadCount() {
    const rows = await this.recentEvents(300);
    return rows.filter((row) => row.tool_id === "memory-search").length;
  }

  async latestStepForAgent(workspaceId: string, agentId: string) {
    return this.db.get<{
      iteration: number;
      phase: string;
      detail: string;
      created_at: string;
    }>(
      `SELECT rs.iteration, rs.phase, rs.detail, rs.created_at
       FROM runtime_steps rs
       JOIN sessions s ON s.session_key = rs.session_key
       WHERE s.agent_id = ?
         AND s.session_key LIKE ?
       ORDER BY rs.id DESC
       LIMIT 1`,
      [agentId, `${workspaceId}:%`]
    );
  }
}
