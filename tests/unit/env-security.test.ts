import { describe, expect, it } from "vitest";
import { __resetEnvForTests, getEnv } from "@/src/server/env";

describe("env security", () => {
  it("fails in strict mode when provider secrets are missing", () => {
    const previous = { ...process.env };

    process.env.GC_STRICT_ENV = "true";
    process.env.TELEGRAM_ALLOWED_USER_IDS = "1";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.OPENAI_API_KEY = "";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.GEMINI_API_KEY = "";

    __resetEnvForTests();
    expect(() => getEnv()).toThrowError(/at least one model provider API key/i);

    process.env = previous;
    __resetEnvForTests();
  });
});
