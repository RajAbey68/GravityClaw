import { describe, expect, it } from "vitest";
import { runAgentLoop } from "@/src/core/runtime/loop";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

describe("runtime loop", () => {
  it("stops at max iterations when reflection never passes", async () => {
    const provider = {
      async generate() {
        return {
          text: "",
          inputTokens: 10,
          outputTokens: 0,
          estimatedCostUsd: 0,
          provider: "mock",
          model: "mock"
        };
      },
      getCurrent() {
        return { provider: "mock", model: "mock" };
      }
    };

    const toolRegistry = {
      async execute() {
        return { ok: false as const, reason: "tool-not-found" };
      }
    };

    const result = await runAgentLoop({
      agentId: "main",
      memoryNamespace: "main",
      message: "do something",
      systemPrompt: "system",
      history: [{ role: "user", content: "do something" }],
      maxIterations: 2,
      providerRegistry: provider,
      toolRegistry,
      eventBus: new SystemEventBus()
    });

    expect(result.finalText).toContain("Iteration limit reached");
    expect(result.steps.filter((step) => step.phase === "reasoning")).toHaveLength(2);
  });
});
