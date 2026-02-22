import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import type { ProviderId } from "@/src/core/providers/types";

type ProviderKey =
  | "OPENAI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "GEMINI_API_KEY"
  | "XAI_API_KEY"
  | "DEEPSEEK_API_KEY"
  | "GROQ_API_KEY"
  | "OPENROUTER_API_KEY";

const KEY_MAP: Record<ProviderKey, ProviderId> = {
  OPENAI_API_KEY: "openai",
  ANTHROPIC_API_KEY: "anthropic",
  GEMINI_API_KEY: "gemini",
  XAI_API_KEY: "xai",
  DEEPSEEK_API_KEY: "deepseek",
  GROQ_API_KEY: "groq",
  OPENROUTER_API_KEY: "openrouter"
};

function upsertEnvLine(content: string, key: ProviderKey, value: string) {
  const escapedValue = value.replace(/\r?\n/g, "").trim();
  const line = `${key}=${escapedValue}`;
  const regex = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

export async function GET() {
  const container = await getAppContainer();
  return NextResponse.json({
    keys: container.providers.keyState()
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    providerKey?: ProviderKey;
    value?: string;
  };

  if (!body.providerKey || !(body.providerKey in KEY_MAP)) {
    return NextResponse.json({ error: "providerKey is required" }, { status: 400 });
  }

  const value = body.value?.trim();
  if (!value) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const container = await getAppContainer();
  const envPath = path.resolve(process.cwd(), ".env");
  const before = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const updated = upsertEnvLine(before || "", body.providerKey, value);
  fs.writeFileSync(envPath, updated, "utf8");
  const prevHash = await container.auditRepo.latestHash();
  const currHash = crypto
    .createHash("sha256")
    .update(`${prevHash ?? ""}|providers.key.update|${body.providerKey}|${new Date().toISOString()}`)
    .digest("hex");
  await container.auditRepo.addLog({
    action: "providers.key.update",
    actorType: "user",
    actorId: "local-ui",
    targetPath: ".env",
    diffPath: "redacted:secret-update",
    summary: `Updated ${body.providerKey} (value redacted).`,
    prevHash,
    currHash
  });
  publishEvent(container.eventBus, {
    type: "audit.log",
    action: "providers.key.update",
    target: ".env",
    diffPath: "redacted:secret-update"
  });

  process.env[body.providerKey] = value;
  await container.providers.setApiKeys({
    [KEY_MAP[body.providerKey]]: value
  });
  const current = container.providers.getCurrent();
  publishEvent(container.eventBus, {
    type: "provider.config.changed",
    provider: current.provider,
    model: current.model,
    failoverEnabled: current.failoverEnabled
  });
  container.docs.record({
    source: "providers",
    detail: `Updated ${body.providerKey} through Providers UI.`
  });

  return NextResponse.json({
    ok: true,
    keys: container.providers.keyState()
  });
}
