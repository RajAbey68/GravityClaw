import { randomUUID } from "node:crypto";
import { ProactiveRepository } from "@/src/core/memory/repositories/proactive";
import { SessionRepository } from "@/src/core/memory/repositories/sessions";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import type { AgentMode } from "@/src/core/types";

interface ProactiveRunnerInput {
  agentId: string;
  message: string;
  mode: AgentMode;
  workspaceId: string;
}

interface ProactiveRulePattern {
  contains: string;
  minOccurrences?: number;
  windowMessages?: number;
  prompt?: string;
  agentId?: string;
  mode?: AgentMode;
  workspaceId?: string;
}

function parseCronIntervalMinutes(expr: string | null | undefined) {
  if (!expr) return undefined;
  const trimmed = expr.trim();
  const everyMatch = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (everyMatch) {
    return Number(everyMatch[1]);
  }

  if (trimmed === "0 * * * *") {
    return 60;
  }

  if (trimmed === "0 */6 * * *") {
    return 360;
  }

  return undefined;
}

export class ProactiveEngine {
  private timer: NodeJS.Timeout | undefined;
  private enabled: boolean;

  constructor(
    private readonly repository: ProactiveRepository,
    private readonly sessions: SessionRepository,
    private readonly eventBus: SystemEventBus,
    private readonly runTask: (input: ProactiveRunnerInput) => Promise<{ finalText: string }>,
    enabled: boolean
  ) {
    this.enabled = enabled;
  }

  get isEnabled() {
    return this.enabled;
  }

  start() {
    if (!this.enabled || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.runCycle("scheduled").catch((error) => {
        publishEvent(this.eventBus, {
          type: "system.info",
          detail: `Proactive cycle failed: ${(error as Error).message}`
        });
      });
    }, 60_000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.start();
      return;
    }
    this.stop();
  }

  async createRule(input: {
    name: string;
    triggerType: "pattern" | "cron";
    cronExpr?: string;
    pattern?: Record<string, unknown>;
    enabled?: boolean;
  }) {
    const id = randomUUID();
    await this.repository.createRule({
      id,
      name: input.name,
      triggerType: input.triggerType,
      cronExpr: input.cronExpr,
      pattern: input.pattern,
      enabled: input.enabled ?? true
    });
    return { id };
  }

  async listRules() {
    const rules = await this.repository.listRules();
    const withRuns = await Promise.all(
      rules.map(async (rule) => ({
        ...rule,
        lastRun: await this.repository.lastRunForRule(rule.id)
      }))
    );
    return withRuns;
  }

  async findRuleByName(name: string) {
    return this.repository.findRuleByName(name);
  }

  async setRuleEnabled(ruleId: string, enabled: boolean) {
    await this.repository.setRuleEnabled(ruleId, enabled);
  }

  async deleteRule(ruleId: string) {
    return this.repository.deleteRule(ruleId);
  }

  async runCycle(trigger: "manual" | "scheduled" = "manual") {
    const rules = await this.repository.listRules();
    const outputs: Array<{ ruleId: string; runId: string; status: string; summary: string }> = [];

    for (const rule of rules) {
      if (rule.enabled !== 1) continue;

      const shouldRun = await this.shouldRunRule(rule.id, rule.trigger_type, rule.cron_expr, rule.pattern_json);
      if (!shouldRun) continue;

      const runId = randomUUID();
      await this.repository.addRun({
        id: runId,
        ruleId: rule.id,
        status: "running",
        outputSummary: `${trigger} trigger accepted`
      });

      publishEvent(this.eventBus, {
        type: "proactive.task",
        taskId: runId,
        trigger: rule.trigger_type,
        status: "running"
      });

      try {
        const prompt = this.resolvePrompt(rule.pattern_json);
        const agentId = this.resolveAgentId(rule.pattern_json);
        const mode = this.resolveMode(rule.pattern_json);
        const workspaceId = this.resolveWorkspaceId(rule.pattern_json);
        const result = await this.runTask({
          agentId,
          message: prompt,
          mode,
          workspaceId
        });

        const summary = result.finalText.slice(0, 320);
        await this.repository.updateRun({
          id: runId,
          status: "completed",
          outputSummary: summary
        });
        outputs.push({ ruleId: rule.id, runId, status: "completed", summary });

        publishEvent(this.eventBus, {
          type: "proactive.task",
          taskId: runId,
          trigger: rule.trigger_type,
          status: "completed"
        });
      } catch (error) {
        await this.repository.updateRun({
          id: runId,
          status: "failed",
          outputSummary: (error as Error).message
        });
        outputs.push({
          ruleId: rule.id,
          runId,
          status: "failed",
          summary: (error as Error).message
        });

        publishEvent(this.eventBus, {
          type: "proactive.task",
          taskId: runId,
          trigger: rule.trigger_type,
          status: "failed"
        });
      }
    }

    return outputs;
  }

  private resolvePrompt(patternJson: string | null) {
    if (!patternJson) {
      return "Run proactive summary and next-step planning.";
    }
    const pattern = JSON.parse(patternJson) as ProactiveRulePattern;
    return pattern.prompt?.trim() || "Run proactive summary and next-step planning.";
  }

  private resolveAgentId(patternJson: string | null) {
    if (!patternJson) return "main";
    const pattern = JSON.parse(patternJson) as ProactiveRulePattern;
    return pattern.agentId?.trim() || "main";
  }

  private resolveMode(patternJson: string | null): AgentMode {
    if (!patternJson) return "direct";
    const pattern = JSON.parse(patternJson) as ProactiveRulePattern;
    if (pattern.mode === "direct" || pattern.mode === "delegated" || pattern.mode === "group") {
      return pattern.mode;
    }
    return "direct";
  }

  private resolveWorkspaceId(patternJson: string | null) {
    if (!patternJson) return "default";
    const pattern = JSON.parse(patternJson) as ProactiveRulePattern;
    return pattern.workspaceId?.trim() || "default";
  }

  private async shouldRunRule(
    ruleId: string,
    triggerType: "pattern" | "cron",
    cronExpr: string | null,
    patternJson: string | null
  ) {
    if (triggerType === "cron") {
      const intervalMinutes = parseCronIntervalMinutes(cronExpr);
      if (!intervalMinutes) {
        return false;
      }

      const lastRun = await this.repository.lastRunForRule(ruleId);
      if (!lastRun) {
        return true;
      }

      const elapsedMs = Date.now() - new Date(lastRun.updated_at).getTime();
      return elapsedMs >= intervalMinutes * 60_000;
    }

    if (!patternJson) {
      return false;
    }

    const pattern = JSON.parse(patternJson) as ProactiveRulePattern;
    const contains = pattern.contains?.trim();
    if (!contains) return false;

    const minOccurrences = pattern.minOccurrences ?? 3;
    const windowMessages = pattern.windowMessages ?? 400;
    const count = await this.sessions.countMessagesContaining(contains, windowMessages);
    const lastRun = await this.repository.lastRunForRule(ruleId);

    if (count < minOccurrences) {
      return false;
    }

    if (!lastRun) {
      return true;
    }

    const elapsed = Date.now() - new Date(lastRun.updated_at).getTime();
    return elapsed >= 15 * 60_000;
  }
}
