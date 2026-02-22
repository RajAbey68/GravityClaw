import { MemoryRepository } from "./repositories/memories";
import { publishEvent } from "../interface/websocket/publisher";
import { SystemEventBus } from "../interface/websocket/event-bus";
import type { AgentRunRequest, AgentRunResult } from "../types";

export interface EvolutionResult {
  consolidatedCount: number;
  newSummaryId?: number;
}

export class MemoryEvolutionEngine {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly eventBus: SystemEventBus,
    private readonly runAgent: (req: AgentRunRequest) => Promise<AgentRunResult>
  ) {}

  /**
   * Scans a namespace for high-usage memories and summarizes them.
   */
  async evolveNamespace(workspaceId: string, namespace: string): Promise<EvolutionResult> {
    const candidates = await this.repository.getMemoriesForEvolution(namespace, 30);
    
    // Only evolve if we have enough density
    if (candidates.length < 5) {
      return { consolidatedCount: 0 };
    }

    // Identify significant memories (those accessed at least once or recently created)
    const salient = candidates.filter(c => c.accessCount > 0 || candidates.indexOf(c) < 10);
    
    if (salient.length < 3) {
      return { consolidatedCount: 0 };
    }

    const contextBlock = salient
      .map(c => `[ID:${c.id}] (Kind:${c.kind}) Content: ${c.content}`)
      .join("\n\n");

    const prompt = `
      The following are recent or frequently accessed memories from the namespace "${namespace}".
      Your task is to synthesize these into a single, high-density "Fact" or "Episodic Summary" that captures the core essence of these events.
      
      Focus on identity, preferences, recurring tasks, or significant outcomes.
      Output ONLY the synthesized summary. Do not include IDs or commentary.
      
      MEMORIES:
      ${contextBlock}
    `.trim();

    try {
      const result = await this.runAgent({
        agentId: "main", // Use main agent for background cognitive work
        message: prompt,
        mode: "direct",
        workspaceId,
        memoryNamespace: namespace,
        systemPromptOverride: "You are the Memory Evolution Engine. You specialize in data compression and semantic synthesis."
      });

      const summary = result.finalText.trim();
      
      // Add the new consolidated memory
      await this.repository.addLongTerm(namespace, "summary", summary);
      
      // Update annotations for summarized items to link them (tagging cluster)
      const clusterId = `evolve-${Date.now()}`;
      for (const memory of salient) {
        await this.repository.updateAnnotation(memory.id as number, { topicCluster: clusterId });
      }

      publishEvent(this.eventBus, {
        type: "system.info",
        detail: `Memory evolution complete for ${namespace}. Consolidated ${salient.length} items.`
      });

      return { consolidatedCount: salient.length };
    } catch (error) {
      console.error("Evolution failed:", error);
      return { consolidatedCount: 0 };
    }
  }

  /**
   * Periodically triggered via heartbeat or proactive engine.
   */
  async runGlobalMaintenance(workspaceId: string) {
    const stats = await this.repository.usageStats();
    if (stats.shortTerm > 50) {
      await this.evolveNamespace(workspaceId, "main");
    }
  }
}
