import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { __resetContainerForTests, getAppContainer } from "@/src/core/container";
import { __resetEnvForTests } from "@/src/server/env";
import { isTelegramUserAllowed } from "@/src/core/interface/telegram/whitelist";

let dbPath = "";

afterEach(() => {
  __resetContainerForTests();
  __resetEnvForTests();
});

describe("integration", () => {
  it("runs orchestrator and persists memory", async () => {
    dbPath = path.join(os.tmpdir(), `gravity-flow-${Date.now()}.sqlite`);

    process.env.DATABASE_PATH = dbPath;
    process.env.TELEGRAM_ALLOWED_USER_IDS = "111";
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.GC_MAX_ITERATIONS = "3";
    process.env.GC_STRICT_ENV = "false";
    process.env.GC_DEFAULT_PROVIDER = "openai";
    process.env.GC_DEFAULT_MODEL = "gpt-4o-mini";
    process.env.OPENAI_API_KEY = "";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.GEMINI_API_KEY = "";

    const container = await getAppContainer();
    const result = await container.orchestrator.run({
      agentId: "main",
      message: "hello",
      mode: "direct",
      source: "ui",
      chatId: "local"
    });

    expect(result.finalText.length).toBeGreaterThan(0);
    const memories = await container.memories.list("main", 10);
    expect(memories.length).toBeGreaterThan(0);
  });

  it("supports delegated mode by spawning/using a sub-agent", async () => {
    dbPath = path.join(os.tmpdir(), `gravity-flow-delegated-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = dbPath;
    process.env.TELEGRAM_ALLOWED_USER_IDS = "111";
    process.env.GC_STRICT_ENV = "false";

    const container = await getAppContainer();
    await container.orchestrator.run({
      agentId: "main",
      message: "/spawn research-bot",
      mode: "direct",
      source: "ui",
      chatId: "local"
    });

    const delegated = await container.orchestrator.run({
      agentId: "main",
      message: "/delegate research-bot summarize the mission",
      mode: "delegated",
      source: "ui",
      chatId: "local"
    });

    expect(delegated.finalText.toLowerCase()).toContain("delegated to research-bot");
  });

  it("supports group mode fanout", async () => {
    dbPath = path.join(os.tmpdir(), `gravity-flow-group-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = dbPath;
    process.env.TELEGRAM_ALLOWED_USER_IDS = "111";
    process.env.GC_STRICT_ENV = "false";

    const container = await getAppContainer();
    await container.orchestrator.run({
      agentId: "main",
      message: "/spawn planner-agent",
      mode: "direct",
      source: "ui",
      chatId: "local"
    });

    const grouped = await container.orchestrator.run({
      agentId: "main",
      message: "health check",
      mode: "group",
      source: "ui",
      chatId: "local"
    });

    expect(grouped.finalText).toContain("[main]");
    expect(grouped.finalText).toContain("[planner-agent]");
  }, 20000);

  it("enforces whitelist function", () => {
    const allowed = new Set(["42"]);
    expect(isTelegramUserAllowed("42", allowed)).toBe(true);
    expect(isTelegramUserAllowed("43", allowed)).toBe(false);
  });
});
