import { randomUUID } from "node:crypto";
import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { ProactiveEngine } from "@/src/core/proactive/proactive-engine";

interface ScheduleTaskInput {
  name: string;
  cron: string;
  task: string;
  agent_id?: string;
  workspace_id?: string;
}

interface ListTasksInput {
  workspace_id?: string;
}

interface CancelTaskInput {
  name: string;
}

function parseHourMinute(value: string) {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridian = (match[3] ?? "").toLowerCase();
  if (meridian === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridian === "am" && hour === 12) {
    hour = 0;
  }
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return undefined;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return undefined;
  return { hour, minute };
}

function parseNaturalCron(raw: string) {
  const value = raw.trim().toLowerCase();
  if (/^([*0-9\/,-]+\s+){4}[*0-9\/,-]+$/.test(value)) {
    return value;
  }

  const everyMinutes = value.match(/^every\s+(\d+)\s+minutes?$/);
  if (everyMinutes) {
    const minutes = Math.max(1, Math.min(Number(everyMinutes[1]), 59));
    return `*/${minutes} * * * *`;
  }

  if (value === "every hour" || value === "hourly") {
    return "0 * * * *";
  }

  const everyday = value.match(/^every\s+day\s+at\s+(.+)$/);
  if (everyday) {
    const parsed = parseHourMinute(everyday[1]);
    if (parsed) return `${parsed.minute} ${parsed.hour} * * *`;
  }

  const weekday = value.match(/^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(.+)$/);
  if (weekday) {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    const parsed = parseHourMinute(weekday[2]);
    if (parsed) return `${parsed.minute} ${parsed.hour} * * ${dayMap[weekday[1]]}`;
  }

  return undefined;
}

export function createSchedulerTools(
  proactive: ProactiveEngine
): Array<ToolDefinition<any, any>> {
  const scheduleTool: ToolDefinition<
    ScheduleTaskInput,
    { id: string; name: string; cron: string; enabled: boolean }
  > = {
    id: "schedule_task",
    description: "Schedule a recurring proactive task using cron or natural language timing.",
    risk: "elevated",
    async execute(input: ScheduleTaskInput, _ctx: ToolExecutionContext) {
      const name = input.name?.trim();
      const cronExpr = parseNaturalCron(input.cron ?? "");
      const task = input.task?.trim();
      const workspaceId = input.workspace_id?.trim() || "default";
      if (!name) throw new Error("name is required");
      if (!task) throw new Error("task is required");
      if (!cronExpr) throw new Error("invalid cron expression or schedule phrase");

      const existing = await proactive.findRuleByName(name);
      if (existing) {
        throw new Error(`task '${name}' already exists`);
      }

      const id = randomUUID();
      await proactive.createRule({
        name,
        triggerType: "cron",
        cronExpr,
        enabled: true,
        pattern: {
          prompt: task,
          agentId: input.agent_id?.trim() || "main",
          mode: "direct",
          workspaceId,
          createdBy: "tool:schedule_task",
          scheduledTaskId: id
        }
      });

      return {
        id,
        name,
        cron: cronExpr,
        enabled: true
      };
    }
  };

  const listTool: ToolDefinition<
    ListTasksInput,
    { tasks: Array<{ id: string; name: string; cron: string | null; enabled: boolean; workspaceId: string }> }
  > = {
    id: "list_tasks",
    description: "List active scheduled tasks.",
    risk: "safe",
    async execute(input: ListTasksInput, _ctx: ToolExecutionContext) {
      const workspaceFilter = input.workspace_id?.trim();
      const rules = await proactive.listRules();
      const tasks = rules
        .filter((rule) => rule.trigger_type === "cron")
        .map((rule) => {
          let workspaceId = "default";
          if (rule.pattern_json) {
            try {
              workspaceId = (JSON.parse(rule.pattern_json) as { workspaceId?: string }).workspaceId ?? "default";
            } catch {
              workspaceId = "default";
            }
          }
          return {
            id: rule.id,
            name: rule.name,
            cron: rule.cron_expr,
            enabled: rule.enabled === 1,
            workspaceId
          };
        })
        .filter((task) => !workspaceFilter || task.workspaceId === workspaceFilter);
      return { tasks };
    }
  };

  const cancelTool: ToolDefinition<CancelTaskInput, { name: string; cancelled: boolean }> = {
    id: "cancel_task",
    description: "Disable a scheduled task by name.",
    risk: "elevated",
    async execute(input: CancelTaskInput, _ctx: ToolExecutionContext) {
      const name = input.name?.trim();
      if (!name) throw new Error("name is required");
      const rule = await proactive.findRuleByName(name);
      if (!rule) {
        throw new Error(`task '${name}' was not found`);
      }
      await proactive.setRuleEnabled(rule.id, false);
      return {
        name,
        cancelled: true
      };
    }
  };

  return [scheduleTool, listTool, cancelTool];
}
