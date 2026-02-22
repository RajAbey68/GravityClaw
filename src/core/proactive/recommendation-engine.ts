import { SystemEventBus } from "../interface/websocket/event-bus";
import { HiveRepository } from "../memory/repositories/hive";
import { SystemEvent } from "../types";

export class RecommendationEngine {
  constructor(
    private eventBus: SystemEventBus,
    private repository: HiveRepository
  ) {
    this.subscribe();
  }

  private subscribe() {
    this.eventBus.subscribe((event: SystemEvent) => {
      if (event.type === "heartbeat.tick") {
        this.analyzeTick(event);
      }
      if (event.type === "agent.stream.completed") {
        this.analyzeUsage(event);
      }
    });
  }

  private analyzeTick(event: any) {
    // Logic to generate recommendations based on heartbeat metrics
    // For example: if overdue tasks > 5, suggest spawning a task coordinator
    if (event.overdueTasks > 5) {
      this.publishRecommendation(
        "productivity",
        "High task volume detected",
        "You have several overdue tasks. Consider spawning a specialized coordinator agent to re-prioritize your backlog.",
        0.85
      );
    }
  }

  private analyzeUsage(event: any) {
    // Logic to generate recommendations based on agent activity
    const usage = event.usage;
    if (usage && usage.inputTokens > 10000) {
      this.publishRecommendation(
        "cost",
        "High context usage",
        `Agent ${event.agentId} is using large context windows. Consider enabling memory compression (Phase 11) to reduce costs.`,
        0.7
      );
    }
  }

  private publishRecommendation(category: string, title: string, detail: string, confidence: number) {
    this.eventBus.publish({
      type: "recommendation.new",
      timestamp: new Date().toISOString(),
      category,
      title,
      detail,
      confidence
    });
    
    console.log(`[RecommendationEngine] New recommendation: ${title}`);
  }
}
