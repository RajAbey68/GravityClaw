import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";

export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

export function evaluateToolPolicy(
  tool: ToolDefinition<unknown, unknown>,
  context: Pick<ToolExecutionContext, "requireConfirmation" | "confirmed">
): PolicyDecision {
  if (tool.risk === "safe") {
    return { allow: true, reason: "safe-tool" };
  }

  if (tool.risk === "elevated") {
    if (context.confirmed || !context.requireConfirmation) {
      return { allow: true, reason: "elevated-confirmed" };
    }
    return { allow: false, reason: "elevated-requires-confirmation" };
  }

  if (context.confirmed) {
    return { allow: true, reason: "dangerous-confirmed" };
  }

  return { allow: false, reason: "dangerous-requires-confirmation" };
}
