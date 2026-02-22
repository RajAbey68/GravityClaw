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

export class HiveOrchestrator {
  constructor(
    private readonly orchestrator: Orchestrator,
    private readonly hiveRepo: HiveRepository,
    private readonly eventBus: SystemEventBus
  ) {}

  async createHive(workspaceId: string, name: string, description?: string): Promise<HiveDescriptor> {
    const hive = await this.hiveRepo.createHive(workspaceId, name, description);
    
    publishEvent(this.eventBus, {
      type: "hive.created",
      hiveId: hive.id,
      workspaceId,
      name: hive.name,
      timestamp: new Date().toISOString()
    });

    await this.hiveRepo.recordLiveFeedEvent({
      workspaceId,
      hiveId: hive.id,
      eventType: "hive.created",
      content: `Hive "${name}" was established.`,
      metadata: JSON.stringify({ description })
    });

    return hive;
  }

  async addAgentToHive(hiveId: string, agentId: string, role = 'worker'): Promise<SwarmMember> {
    const member = await this.hiveRepo.addSwarmMember(hiveId, agentId, role);
    const hive = await this.hiveRepo.getHive(hiveId);
    
    if (hive) {
      publishEvent(this.eventBus, {
        type: "swarm.member.joined",
        hiveId,
        agentId,
        role,
        timestamp: new Date().toISOString()
      });

      await this.hiveRepo.recordLiveFeedEvent({
        workspaceId: hive.workspaceId,
        hiveId,
        eventType: "swarm.member.joined",
        actorId: agentId,
        actorType: "agent",
        content: `Agent ${agentId} joined the swarm as ${role}.`
      });
    }

    return member;
  }

  async broadcastToHive(hiveId: string, message: string, sourceAgentId?: string): Promise<void> {
    const hive = await this.hiveRepo.getHive(hiveId);
    if (!hive) throw new Error("Hive not found");

    const members = await this.hiveRepo.listSwarmMembers(hiveId);
    
    await this.hiveRepo.recordLiveFeedEvent({
      workspaceId: hive.workspaceId,
      hiveId,
      eventType: "hive.broadcast",
      actorId: sourceAgentId,
      actorType: sourceAgentId ? "agent" : "user",
      content: `Broadcast to Hive: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`
    });

    // In a real swarm, this might trigger parallel runs or updates
    // For now, we notify listeners
    publishEvent(this.eventBus, {
      type: "live_feed.event",
      eventId: randomUUID(),
      workspaceId: hive.workspaceId,
      eventType: "hive.broadcast",
      content: message,
      timestamp: new Date().toISOString()
    } as any);
  }

  async runHiveTask(hiveId: string, goal: string): Promise<void> {
    const hive = await this.hiveRepo.getHive(hiveId);
    if (!hive) throw new Error("Hive not found");

    await this.hiveRepo.recordLiveFeedEvent({
      workspaceId: hive.workspaceId,
      hiveId,
      eventType: "hive.task.started",
      content: `Collective goal initiated: ${goal}`
    });

    // Mesh/Swarm logic: Decompose and assign
    // This will be expanded in Phase 10, but we lay the groundwork here
    publishEvent(this.eventBus, {
      type: "mesh.started",
      meshId: randomUUID(),
      goal,
      subtaskCount: 0,
      timestamp: new Date().toISOString()
    });
  }
}
