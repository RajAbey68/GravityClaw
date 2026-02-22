import { Pinecone, type PineconeRecord } from "@pinecone-database/pinecone";
import type { MemoryRepository } from "./repositories/memories";
import type { ModelProvider } from "../providers/types";
import { publishEvent } from "../interface/websocket/publisher";
import { SystemEventBus } from "../interface/websocket/event-bus";

export interface SyncStats {
  totalSynced: number;
  errors: number;
}

export class PineconeSyncService {
  private client: Pinecone | undefined;
  private readonly indexName: string;
  private readonly enabled: boolean;

  constructor(
    private readonly repository: MemoryRepository,
    private readonly provider: ModelProvider,
    private readonly eventBus: SystemEventBus,
    config: { apiKey?: string; indexName?: string; enabled?: boolean }
  ) {
    this.indexName = config.indexName || "gravity-claw";
    this.enabled = !!(config.enabled && config.apiKey);
    
    if (this.enabled && config.apiKey) {
      this.client = new Pinecone({ apiKey: config.apiKey });
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  /**
   * Syncs new or updated memories to Pinecone.
   */
  async sync(limit = 100): Promise<SyncStats> {
    if (!this.enabled || !this.client) {
      return { totalSynced: 0, errors: 0 };
    }

    try {
      const memories = await this.repository.list(undefined, limit);
      const index = this.client.Index(this.indexName);
      
      let totalSynced = 0;
      let errors = 0;

      for (const memory of memories) {
        try {
          // Generate embedding
          const { embedding, failed } = await this.provider.embed(memory.content);
          if (failed || embedding.length === 0) {
            errors++;
            continue;
          }

          const record: PineconeRecord = {
            id: `mem-${memory.id}`,
            values: embedding,
            metadata: {
              namespace: memory.namespace,
              kind: memory.kind,
              content: memory.content,
              createdAt: memory.created_at
            }
          };

          await index.upsert([record]);
          totalSynced++;
        } catch (err) {
          console.error(`Pinecone sync failed for memory ${memory.id}:`, err);
          errors++;
        }
      }

      publishEvent(this.eventBus, {
        type: "system.info",
        detail: `Pinecone sync complete: ${totalSynced} synced, ${errors} errors.`
      });

      return { totalSynced, errors };
    } catch (error) {
      console.error("Pinecone global sync failed:", error);
      return { totalSynced: 0, errors: 1 };
    }
  }

  /**
   * Performs a vector search in Pinecone and returns memory IDs.
   */
  async vectorSearch(query: string, limit = 10): Promise<number[]> {
    if (!this.enabled || !this.client) {
      return [];
    }

    try {
      const { embedding, failed } = await this.provider.embed(query);
      if (failed || embedding.length === 0) return [];

      const index = this.client.Index(this.indexName);
      const results = await index.query({
        vector: embedding,
        topK: limit,
        includeMetadata: false
      });

      return results.matches
        .map(m => parseInt(m.id.replace("mem-", ""), 10))
        .filter(id => !isNaN(id));
    } catch (error) {
      console.error("Pinecone vector search failed:", error);
      return [];
    }
  }
}
