import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";

interface MemoryWriteInput {
  namespace: string;
  kind: string;
  content: string;
}

interface MemoryWriteOutput {
  ok: true;
  namespace: string;
  kind: string;
}

export function createMemoryWriteTool(memories: MemoryRepository): ToolDefinition<MemoryWriteInput, MemoryWriteOutput> {
  return {
    id: "memory-write",
    description: "Persist structured memory into the long-term store.",
    risk: "safe",
    async execute(input: MemoryWriteInput, ctx: ToolExecutionContext) {
      await memories.addLongTerm(ctx.workspaceId, input.namespace, input.kind || "note", input.content);
      return {
        ok: true,
        namespace: input.namespace,
        kind: `long-term:${input.kind || "note"}`
      };
    }
  };
}
