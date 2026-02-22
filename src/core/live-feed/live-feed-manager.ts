import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { HiveRepository } from "@/src/core/memory/repositories/hive";
import type { SystemEvent } from "@/src/core/types";

export class LiveFeedManager {
  constructor(
    private readonly eventBus: SystemEventBus,
    private readonly hiveRepo: HiveRepository
  ) {}

  init() {
    this.eventBus.on("event", (event: SystemEvent) => {
      this.handleEvent(event).catch((err) => {
        console.error("Failed to persist live feed event:", err);
      });
    });
  }

  private async handleEvent(event: SystemEvent) {
    // Filter for events we want to show in the live feed
    let content = "";
    let eventType = event.type;
    let actorId = (event as any).agentId;
    let actorType = actorId ? "agent" : "system";
    let workspaceId = (event as any).workspaceId || "default";
    let hiveId = (event as any).hiveId;

    switch (event.type) {
      case "agent.spawned":
        content = `Agent ${event.agentId} has been awakened.`;
        break;
      case "agent.status.changed":
        content = `Agent ${event.agentId} status changed to ${event.status}.`;
        break;
      case "tool.called":
        content = `Agent ${event.agentId} invoked tool: ${event.toolId}.`;
        break;
      case "agent.step.completed":
        content = `Agent ${event.agentId} completed step: ${event.step.slice(0, 50)}...`;
        break;
      case "hive.created":
        content = `A new Hive "${event.name}" was established.`;
        break;
      case "swarm.member.joined":
        content = `Agent ${event.agentId} joined the swarm as ${event.role}.`;
        break;
      case "delegation.created":
        content = `Agent ${event.fromAgentId} delegated a task to ${event.toAgentId}: ${event.objective.slice(0, 50)}...`;
        break;
      case "live_feed.event":
        // Already recorded or broadcasted, but we can capture custom ones here
        return; 
      default:
        // Skip uninteresting internal events (like heartbeats)
        return;
    }

    if (content) {
      await this.hiveRepo.recordLiveFeedEvent({
        workspaceId,
        hiveId,
        eventType,
        actorId,
        actorType,
        content,
        metadata: JSON.stringify(event)
      });
    }
  }
}
