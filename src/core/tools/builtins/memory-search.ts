import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";

interface MemorySearchInput {
  query: string;
  namespaces?: string[];
  limit?: number;
}

interface MemorySearchOutput {
  count: number;
  results: Array<{ id: number; namespace: string; kind: string; content: string; rank: number }>;
}

export function createMemorySearchTool(memories: MemoryRepository): ToolDefinition<MemorySearchInput, MemorySearchOutput> {
  return {
    id: "memory-search",
    description: "Search long-term memory using SQLite FTS5.",
    risk: "safe",
    async execute(input: MemorySearchInput, ctx: ToolExecutionContext) {
      const results = await memories.search({
        workspaceId: ctx.workspaceId,
        query: input.query,
        namespaces: input.namespaces,
        limit: input.limit ?? 8
      });

      return {
        count: results.length,
        results: results.map((row) => ({
          id: row.id,
          namespace: row.namespace,
          kind: row.kind,
          content: row.content,
          rank: row.rank
        }))
      };
    }
  };
}
