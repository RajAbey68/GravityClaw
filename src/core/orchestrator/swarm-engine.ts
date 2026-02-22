import { randomUUID } from "node:crypto";
import type { 
  AgentDescriptor, 
  AgentRunRequest, 
  AgentRunResult, 
  HiveDescriptor, 
  SwarmMember,
  SystemEvent
} from "@/src/core/types";
import { Orchestrator } from "@/src/core/orchestrator/orchestrator";
import { HiveRepository } from "@/src/core/memory/repositories/hive";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

export class SwarmEngine {
  constructor(
    private readonly orchestrator: Orchestrator,
    private readonly hiveRepo: HiveRepository,
    private readonly eventBus: SystemEventBus
  ) {}

  async decomposeAndExecute(hiveId: string, goal: string, workspaceId: string): Promise<string> {
    const hive = await this.hiveRepo.getHive(hiveId);
    if (!hive) throw new Error("Hive not found");

    const members = await this.hiveRepo.listSwarmMembers(hiveId);
    if (members.length === 0) {
      return "No agents available in this hive to execute the goal.";
    }

    publishEvent(this.eventBus, {
      type: "mesh.started",
      meshId: randomUUID(),
      goal,
      subtaskCount: members.length,
      timestamp: new Date().toISOString()
    });

    // In a mature swarm, we would use an LLM to decompose the goal.
    // For the foundation, we broadcast the goal to all workers and synthesize.
    
    const subtaskResults = await Promise.all(members.map(async (member) => {
      const subtaskId = randomUUID();
      publishEvent(this.eventBus, {
        type: "mesh.subtask.assigned",
        meshId: "current", // needs real mesh tracking
        subtaskId,
        agentId: member.agentId,
        objective: goal,
        timestamp: new Date().toISOString()
      });

      try {
        const result = await this.orchestrator.run({
          agentId: member.agentId,
          message: `Swarm Objective: ${goal}. contribution from your role: ${member.role}`,
          mode: "direct",
          workspaceId
        });

        publishEvent(this.eventBus, {
          type: "mesh.subtask.completed",
          meshId: "current",
          subtaskId,
          agentId: member.agentId,
          status: "completed",
          timestamp: new Date().toISOString()
        });

        return `[${member.agentId}]: ${result.finalText}`;
      } catch (error) {
        publishEvent(this.eventBus, {
          type: "mesh.subtask.completed",
          meshId: "current",
          subtaskId,
          agentId: member.agentId,
          status: "failed",
          timestamp: new Date().toISOString()
        });
        return `[${member.agentId}]: Failed with error ${String(error)}`;
      }
    }));

    const finalSynthesis = `Collective result for goal "${goal}":\n\n${subtaskResults.join("\n\n")}`;
    
    await this.hiveRepo.recordLiveFeedEvent({
      workspaceId,
      hiveId,
      eventType: "hive.task.completed",
      content: `Goal completed: ${goal}`
    });

    publishEvent(this.eventBus, {
      type: "mesh.completed",
      meshId: "current",
      status: "completed",
      summary: finalSynthesis,
      timestamp: new Date().toISOString()
    });

    return finalSynthesis;
  }
}
