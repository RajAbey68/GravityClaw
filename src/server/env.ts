import "dotenv/config";
import { z } from "zod";
import { PROVIDER_IDS } from "@/src/core/providers/types";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  // In production (Railway) the volume is mounted at /data — set DATABASE_PATH=/data/gravity-claw.sqlite.
  // Default keeps local dev working without extra config.
  DATABASE_PATH: z.string().default("./data/gravity-claw.sqlite"),
  // When set, mission/tasks requests are proxied to this service URL.
  // Unset = monolith handles tasks directly (default, safe fallback).
  TASKS_SERVICE_URL: z.string().url().optional(),
  // Shared secret for internal service-to-service calls.
  INTERNAL_SERVICE_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALLOWED_USER_IDS: z.string().default("0"),
  TELEGRAM_POLL_INTERVAL_MS: z.coerce.number().default(1800),
  GC_MAX_ITERATIONS: z.coerce.number().int().min(1).max(30).default(6),
  GC_MAX_GROUP_ROUNDS: z.coerce.number().int().min(1).max(8).default(2),
  GC_DEFAULT_PROVIDER: z.enum(PROVIDER_IDS).default("openai"),
  GC_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),
  GC_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  GC_STRICT_ENV: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_ENABLED: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("EXAVITQu4vr4xnSDxMaL"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  FORGE_ENABLED: z.string().optional(),
  PROACTIVE_ENABLED: z.string().optional(),
  BROWSER_AUTOMATION_ENABLED: z.string().optional(),
  SHELL_EXEC_ENABLED: z.string().optional(),
  MCP_ENABLED: z.string().optional(),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().default("gravity-claw"),
  PINECONE_ENVIRONMENT: z.string().optional(),
  PINECONE_ENABLED: z.string().optional(),
  AUTH_TOKEN: z.string().optional(),
  WHISPER_MODEL: z.string().default("whisper-1"),
  SERPAPI_KEY: z.string().optional(),
  BRAVE_SEARCH_KEY: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema> & {
  allowedTelegramUsers: Set<string>;
  strictEnv: boolean;
  forgeEnabled: boolean;
  proactiveEnabled: boolean;
  ollamaEnabled: boolean;
  browserAutomationEnabled: boolean;
  shellExecEnabled: boolean;
  mcpEnabled: boolean;
  pineconeEnabled: boolean;
  tasksServiceUrl: string | undefined;
};

let cachedEnv: AppEnv | null = null;

function toBoolean(raw: string | undefined, fallback = false) {
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.parse(process.env);
  const strictEnv = toBoolean(parsed.GC_STRICT_ENV, false);
  const forgeEnabled = toBoolean(parsed.FORGE_ENABLED, false);
  const proactiveEnabled = toBoolean(parsed.PROACTIVE_ENABLED, false);
  const ollamaEnabled = toBoolean(parsed.OLLAMA_ENABLED, false);
  const browserAutomationEnabled = toBoolean(parsed.BROWSER_AUTOMATION_ENABLED, true);
  const shellExecEnabled = toBoolean(parsed.SHELL_EXEC_ENABLED, false);
  const mcpEnabled = toBoolean(parsed.MCP_ENABLED, true);
  const pineconeEnabled = toBoolean(parsed.PINECONE_ENABLED, false);
  const allowedTelegramUsers = new Set(
    parsed.TELEGRAM_ALLOWED_USER_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  if (allowedTelegramUsers.size === 0) {
    throw new Error("TELEGRAM_ALLOWED_USER_IDS is required and cannot be empty.");
  }

  if (!Number.isFinite(parsed.GC_MAX_ITERATIONS) || parsed.GC_MAX_ITERATIONS < 1) {
    throw new Error("GC_MAX_ITERATIONS must be configured to a positive number.");
  }

  if (strictEnv) {
    if (!parsed.TELEGRAM_BOT_TOKEN) {
      throw new Error("GC_STRICT_ENV enabled: TELEGRAM_BOT_TOKEN is required.");
    }
    const hasAnyModelProvider = Boolean(
      parsed.OPENAI_API_KEY ||
        parsed.ANTHROPIC_API_KEY ||
        parsed.GEMINI_API_KEY ||
        parsed.XAI_API_KEY ||
        parsed.DEEPSEEK_API_KEY ||
        parsed.GROQ_API_KEY ||
        parsed.OPENROUTER_API_KEY ||
        ollamaEnabled
    );
    if (!hasAnyModelProvider) {
      throw new Error("GC_STRICT_ENV enabled: at least one model provider API key is required.");
    }
  }

  cachedEnv = {
    ...parsed,
    allowedTelegramUsers,
    strictEnv,
    forgeEnabled,
    proactiveEnabled,
    ollamaEnabled,
    browserAutomationEnabled,
    shellExecEnabled,
    mcpEnabled,
    pineconeEnabled,
    tasksServiceUrl: parsed.TASKS_SERVICE_URL
  };

  return cachedEnv;
}

export function __resetEnvForTests() {
  cachedEnv = null;
}
