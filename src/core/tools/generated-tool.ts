import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";

export interface GeneratedToolManifest {
  id: string;
  description: string;
  risk: "safe" | "elevated" | "dangerous";
  capability: string;
  responseTemplate: string;
  version: string;
}

function template(text: string, input: unknown) {
  const serialized = JSON.stringify(input ?? {}, null, 2);
  return text.replaceAll("{{input}}", serialized).replaceAll("{{timestamp}}", new Date().toISOString());
}

export function createGeneratedTool(manifest: GeneratedToolManifest): ToolDefinition<Record<string, unknown>, {
  ok: boolean;
  capability: string;
  output: string;
  executedAt: string;
  actor: string;
}> {
  return {
    id: manifest.id,
    description: manifest.description,
    risk: manifest.risk,
    async execute(input: Record<string, unknown>, ctx: ToolExecutionContext) {
      return {
        ok: true,
        capability: manifest.capability,
        output: template(manifest.responseTemplate, input),
        executedAt: new Date().toISOString(),
        actor: ctx.agentId
      };
    }
  };
}

