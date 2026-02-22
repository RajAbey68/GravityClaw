import { describe, expect, it } from "vitest";
import { ToolRegistry } from "@/src/core/tools/registry";
import type { ToolDefinition } from "@/src/core/types";

interface DangerousInput {
  value: string;
}

const dangerousTool: ToolDefinition<DangerousInput, { echoed: string }> = {
  id: "dangerous-echo",
  description: "Dangerous echo",
  risk: "dangerous",
  async execute(input) {
    return { echoed: input.value };
  }
};

describe("tool confirmation", () => {
  it("requires explicit confirmation for dangerous tools", async () => {
    const registry = new ToolRegistry();
    registry.register(dangerousTool);

    const first = await registry.execute("dangerous-echo", { value: "hello" }, {
      agentId: "main",
      requireConfirmation: true,
      confirmed: false
    });

    expect(first.ok).toBe(false);
    if (first.ok) {
      throw new Error("Expected first execution to require confirmation");
    }
    expect(first.requiresConfirmation).toBe(true);
    expect(first.confirmation?.id).toBeTruthy();

    const confirmed = await registry.executeConfirmation<{ echoed: string }>(first.confirmation?.id ?? "");
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.output.echoed).toBe("hello");
    }
  });
});
