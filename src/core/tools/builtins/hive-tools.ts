import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { HiveOrchestrator } from "@/src/core/orchestrator/hive-orchestrator";
import { SwarmEngine } from "@/src/core/orchestrator/swarm-engine";

interface HiveBroadcastInput {
  hiveId: string;
  message: string;
}

interface SwarmTaskInput {
  hiveId: string;
  goal: string;
  workspaceId?: string;
}

export function createHiveTools(
  hiveOrchestrator: HiveOrchestrator,
  swarmEngine: SwarmEngine
): Array<ToolDefinition<any, any>> {
  const broadcastTool: ToolDefinition<HiveBroadcastInput, { ok: boolean }> = {
    id: "hive_broadcast",
    description: "Send a real-time message to all agents in the Hive and record it in the live feed.",
    risk: "safe",
    async execute(input: HiveBroadcastInput, ctx: ToolExecutionContext) {
      if (!input.hiveId || !input.message) {
        throw new Error("hiveId and message are required");
      }
      await hiveOrchestrator.broadcastToHive(input.hiveId, input.message, ctx.agentId);
      return { ok: true };
    }
  };

  const swarmTaskTool: ToolDefinition<SwarmTaskInput, { result: string }> = {
    id: "swarm_task",
    description: "Initiate a collective swarm task where all agents in the hive cooperate to achieve a goal.",
    risk: "elevated",
    async execute(input: SwarmTaskInput, ctx: ToolExecutionContext) {
      if (!input.hiveId || !input.goal) {
        throw new Error("hiveId and goal are required");
      }
      const result = await swarmEngine.decomposeAndExecute(
        input.hiveId,
        input.goal,
        ctx.workspaceId
      );
      return { result };
    }
  };

  return [broadcastTool, swarmTaskTool];
}
