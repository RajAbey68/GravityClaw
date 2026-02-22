import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";

interface HealthCheckInput {
  requestId?: string;
}

interface HealthCheckOutput {
  ok: boolean;
  now: string;
  pid: number;
  requestId?: string;
}

export const healthCheckTool: ToolDefinition<HealthCheckInput, HealthCheckOutput> = {
  id: "health-check",
  description: "Return basic runtime health signal and timestamp.",
  risk: "safe",
  async execute(input: HealthCheckInput, _ctx: ToolExecutionContext) {
    return {
      ok: true,
      now: new Date().toISOString(),
      pid: process.pid,
      requestId: input.requestId
    };
  }
};
