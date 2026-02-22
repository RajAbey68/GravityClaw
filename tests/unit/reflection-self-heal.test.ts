import { describe, expect, it } from "vitest";
import { runAgentLoop } from "@/src/core/runtime/loop";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

describe("runtime self-healing", () => {
  it("retries failed reflection output and aggregates usage", async () => {
    let calls = 0;
    const provider = {
      async generate() {
        calls += 1;
        if (calls === 1) {
          return {
            text: "too short",
            inputTokens: 10,
            outputTokens: 2,
            estimatedCostUsd: 0.001,
            provider: "mock",
            model: "mock"
          };
        }

        return {
          text: "Detailed response with concrete steps and actionable output.",
          inputTokens: 18,
          outputTokens: 6,
          estimatedCostUsd: 0.003,
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
      memoryNamespace: "workspace:default:main",
      message: "plan next actions",
      systemPrompt: "system",
      history: [{ role: "user", content: "plan next actions" }],
      maxIterations: 3,
      providerRegistry: provider,
      toolRegistry,
      eventBus: new SystemEventBus()
    });

    expect(calls).toBe(2);
    expect(result.finalText).toContain("actionable output");
    expect(result.usage.inputTokens).toBe(28);
    expect(result.usage.outputTokens).toBe(8);
    expect(result.usage.estimatedCostUsd).toBe(0.004);
    expect(result.steps.filter((step) => step.phase === "reflection")).toHaveLength(2);
  });
});
