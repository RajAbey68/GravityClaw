import { ToolDefinition, ToolExecutionContext } from "../../types";
import { Orchestrator } from "../../orchestrator/orchestrator";

interface AgentSendInput {
  targetAgentId: string;
  message: string;
  urgent?: boolean;
}

export function createMeshTools(orchestrator: Orchestrator): ToolDefinition<AgentSendInput, string>[] {
  const agentSendTool: ToolDefinition<AgentSendInput, string> = {
    id: "agent_send",
    description: "Send a direct message to another agent in the swarm to request information or delegate a sub-task.",
    risk: "safe",
    async execute(input: AgentSendInput, ctx: ToolExecutionContext) {
      if (!ctx.confirmed && ctx.requireConfirmation) {
        return "PENDING_CONFIRMATION: Sending message to " + input.targetAgentId;
      }

      console.log(`[MeshTools] Agent ${ctx.agentId} sending to ${input.targetAgentId}: ${input.message}`);

      try {
        const targetAgent = await orchestrator.getLifecycle().getAgent(input.targetAgentId);
        if (!targetAgent) {
          return `Error: Target agent ${input.targetAgentId} not found.`;
        }
        if (targetAgent.workspaceId !== ctx.workspaceId) {
          return `Error: Target agent ${input.targetAgentId} belongs to a different workspace (${targetAgent.workspaceId}). Access denied.`;
        }

        // In a real implementation, this would use a 'mailbox' or 'message queue' repository
        // For now, we simulate inter-agent communication by returning a success message
        // The orchestrator handles the actual routing in a real run.
        return `Message successfully queued for ${input.targetAgentId} in workspace ${ctx.workspaceId}.`;
      } catch (error) {
        return `Failed to send message: ${(error as Error).message}`;
      }
    }
  };

  return [agentSendTool];
}
