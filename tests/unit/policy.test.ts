import { describe, expect, it } from "vitest";
import { evaluateToolPolicy } from "@/src/core/tools/policy";
import type { ToolDefinition } from "@/src/core/types";

const dangerousTool: ToolDefinition<unknown, unknown> = {
  id: "danger",
  description: "danger",
  risk: "dangerous",
  execute: async () => ({})
};

describe("tool policy", () => {
  it("blocks dangerous tools without confirmation", () => {
    const decision = evaluateToolPolicy(dangerousTool, { requireConfirmation: true, confirmed: false });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain("requires-confirmation");
  });

  it("allows dangerous tools when confirmed", () => {
    const decision = evaluateToolPolicy(dangerousTool, { requireConfirmation: true, confirmed: true });
    expect(decision.allow).toBe(true);
  });
});
