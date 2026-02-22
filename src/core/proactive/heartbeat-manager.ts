import { SystemEventBus } from "../interface/websocket/event-bus";
import { HiveRepository } from "../memory/repositories/hive";

export class HeartbeatManager {
  private interval: NodeJS.Timeout | null = null;
  private readonly TICK_INTERVAL = 30000; // 30 seconds

  constructor(
    private eventBus: SystemEventBus,
    private repository: HiveRepository
  ) {}

  public start() {
    if (this.interval) return;
    
    // Initial tick
    void this.tick();
    
    this.interval = setInterval(() => {
      void this.tick();
    }, this.TICK_INTERVAL);
    
    console.log("[HeartbeatManager] Pulse started");
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick() {
    try {
      // Gather system-wide metrics for the heartbeat from the repository
      const workspaceId = "default"; // Target default workspace for now
      
      const [pendingMessages, overdueTasks] = await Promise.all([
        this.repository.countPendingMessages(workspaceId),
        this.repository.countOverdueTasks(workspaceId)
      ]);
      
      const flaggedMemory = 0; // Placeholder for future memory scan logic

      this.eventBus.publish({
        type: "heartbeat.tick",
        timestamp: new Date().toISOString(),
        pendingMessages,
        overdueTasks,
        flaggedMemory
      });

    } catch (error) {
      console.error("[HeartbeatManager] Tick failed", error);
    }
  }
}
