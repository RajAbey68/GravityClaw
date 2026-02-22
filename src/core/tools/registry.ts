import { runWithTimeout } from "@/src/core/tools/sandbox";
import { evaluateToolPolicy } from "@/src/core/tools/policy";
import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { ToolConfirmationManager } from "@/src/core/tools/confirmation";

type ConfirmationPayload = {
  id: string;
  toolId: string;
  agentId: string;
  reason: string;
  risk: "elevated" | "dangerous";
  expiresAt: string;
};

export type ToolExecutionResponse<TOutput> =
  | { ok: true; output: TOutput }
  | {
      ok: false;
      reason: string;
      requiresConfirmation?: boolean;
      confirmation?: ConfirmationPayload;
    };

interface ToolRuntimeConfig {
  enabled: boolean;
  requireConfirmation: boolean;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any, any>>();
  private readonly invocationCounts = new Map<string, Map<string, number>>();
  private readonly configs = new Map<string, Map<string, ToolRuntimeConfig>>();

  constructor(private readonly confirmations = new ToolConfirmationManager()) {}

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>) {
    this.tools.set(tool.id, tool);
  }

  has(toolId: string) {
    return this.tools.has(toolId);
  }

  getConfig(workspaceId: string, toolId: string) {
    const wsConfigs = this.configs.get(workspaceId);
    if (wsConfigs?.has(toolId)) {
      return wsConfigs.get(toolId)!;
    }
    const tool = this.tools.get(toolId);
    return {
      enabled: true,
      requireConfirmation: tool?.risk !== "safe"
    };
  }

  setConfig(workspaceId: string, toolId: string, patch: Partial<ToolRuntimeConfig>) {
    if (!this.configs.has(workspaceId)) {
      this.configs.set(workspaceId, new Map());
    }
    const wsConfigs = this.configs.get(workspaceId)!;
    const current = this.getConfig(workspaceId, toolId);
    wsConfigs.set(toolId, {
      ...current,
      ...patch
    });
  }

  loadConfigs(workspaceId: string, configs: Record<string, ToolRuntimeConfig>) {
    for (const [toolId, config] of Object.entries(configs)) {
      if (!this.tools.has(toolId)) continue;
      this.setConfig(workspaceId, toolId, config);
    }
  }

  list(workspaceId: string) {
    const wsInvocations = this.invocationCounts.get(workspaceId);
    return [...this.tools.values()].map((tool) => ({
      id: tool.id,
      description: tool.description,
      risk: tool.risk,
      invocations: wsInvocations?.get(tool.id) ?? 0,
      enabled: this.getConfig(workspaceId, tool.id).enabled,
      requireConfirmation: this.getConfig(workspaceId, tool.id).requireConfirmation,
      sandboxed: true
    }));
  }

  listConfirmations() {
    return this.confirmations.list();
  }

  async execute<TInput, TOutput>(
    toolId: string,
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResponse<TOutput>> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { ok: false, reason: "tool-not-found" };
    }

    const config = this.getConfig(context.workspaceId, toolId);
    if (!config.enabled) {
      return { ok: false, reason: "tool-disabled" };
    }

    if (config.requireConfirmation && context.requireConfirmation && !context.confirmed) {
      const confirmation = this.confirmations.create({
        toolId,
        input,
        agentId: context.agentId,
        reason: "tool-config-requires-confirmation",
        risk: tool.risk === "dangerous" ? "dangerous" : "elevated"
      });

      return {
        ok: false,
        reason: "tool-config-requires-confirmation",
        requiresConfirmation: true,
        confirmation: {
          id: confirmation.id,
          toolId,
          agentId: confirmation.agentId,
          reason: confirmation.reason,
          risk: confirmation.risk,
          expiresAt: confirmation.expiresAt
        }
      };
    }

    const policy = evaluateToolPolicy(tool, context);
    if (!policy.allow) {
      if (policy.reason.includes("requires-confirmation")) {
        const confirmation = this.confirmations.create({
          toolId,
          input,
          agentId: context.agentId,
          reason: policy.reason,
          risk: tool.risk === "dangerous" ? "dangerous" : "elevated"
        });

        return {
          ok: false,
          reason: policy.reason,
          requiresConfirmation: true,
          confirmation: {
            id: confirmation.id,
            toolId,
            agentId: confirmation.agentId,
            reason: confirmation.reason,
            risk: confirmation.risk,
            expiresAt: confirmation.expiresAt
          }
        };
      }
      return { ok: false, reason: policy.reason };
    }

    const output = await runWithTimeout(() => tool.execute(input as never, context) as Promise<TOutput>);
    
    if (!this.invocationCounts.has(context.workspaceId)) {
      this.invocationCounts.set(context.workspaceId, new Map());
    }
    const wsInvocations = this.invocationCounts.get(context.workspaceId)!;
    wsInvocations.set(tool.id, (wsInvocations.get(tool.id) ?? 0) + 1);

    return { ok: true, output };
  }

  async executeConfirmation<TOutput>(confirmationId: string): Promise<ToolExecutionResponse<TOutput>> {
    const pending = this.confirmations.consume(confirmationId);
    if (!pending) {
      return { ok: false, reason: "confirmation-not-found" };
    }

    return this.execute(pending.toolId, pending.input, {
      agentId: pending.agentId,
      workspaceId: "default", // Defaulting for confirmations, should hopefully be updated if we track ws in confirmations
      requireConfirmation: true,
      confirmed: true
    });
  }
}
