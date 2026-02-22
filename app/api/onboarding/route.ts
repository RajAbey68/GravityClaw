import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import type { ProviderId } from "@/src/core/providers/types";

type ProviderName = ProviderId;

const SECURITY_BASELINE: Record<string, string> = {
  "global.iterationLimit": "6",
  "global.reflectionEnabled": "true",
  "global.maxTokenLimit": "4000",
  "global.costThresholdUsd": "10",
  "global.autoSpawnEnabled": "true",
  "global.proactiveEnabled": "true",
  "global.security.requireDangerousConfirmation": "true"
};

function mapConfigs(rows: Array<{ key: string; value: string }>) {
  const mapped = new Map<string, string>();
  for (const row of rows) {
    mapped.set(row.key, row.value);
  }
  return mapped;
}

function isAllowlistConfigured(users: Set<string>) {
  return users.size > 1 || !users.has("0");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const container = await getAppContainer();

  await container.lifecycle.ensureWorkspace(workspaceId);
  const workspace = await container.workspaces.get(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const keyState = container.providers.keyState();
  const providerReady = Object.values(keyState).some((entry) => entry.configured);
  const providerCurrent = container.providers.getCurrent();
  const subAgents = container.lifecycle.listSubAgents(workspaceId);
  const workspaceConfigRows = await container.workspaces.listConfigs(workspaceId);
  const workspaceConfigs = mapConfigs(workspaceConfigRows);
  const goal = workspaceConfigs.get("onboarding.primaryGoal") ?? "";
  const completedAt = workspaceConfigs.get("onboarding.completedAt") ?? "";
  const settings = Object.fromEntries(
    await Promise.all(
      Object.keys(SECURITY_BASELINE).map(async (key) => [key, await container.memories.getSetting(key)])
    )
  );
  const securityBaselineDone = Object.entries(SECURITY_BASELINE).every(([key, value]) => {
    const current = settings[key];
    if (!current) return false;
    return current === value;
  });
  const voiceConfigured = Boolean(container.env.ELEVENLABS_API_KEY);
  const twilioConfigured = Boolean(
    container.env.TWILIO_ACCOUNT_SID &&
      container.env.TWILIO_AUTH_TOKEN &&
      container.env.TWILIO_FROM_NUMBER
  );

  const steps = [
    {
      id: "provider-key",
      title: "Configure a provider key",
      question: "Add at least one model provider API key to start runtime generation.",
      done: providerReady
    },
    {
      id: "provider-default",
      title: "Choose default provider/model",
      question: "Set default provider and model for this workspace runtime.",
      done: Boolean(providerCurrent.provider && providerCurrent.model)
    },
    {
      id: "workspace-goal",
      title: "Define workspace objective",
      question: "Document the primary objective so new agents inherit intent context.",
      done: goal.trim().length > 0
    },
    {
      id: "sub-agent",
      title: "Create your first sub-agent",
      question: "Spawn at least one specialist sub-agent for delegated/group workflows.",
      done: subAgents.length > 0
    },
    {
      id: "security-baseline",
      title: "Apply security baseline",
      question:
        "Apply baseline controls for reflection, iteration limits, cost threshold, and dangerous-tool confirmation.",
      done: securityBaselineDone
    },
    {
      id: "telegram-allowlist",
      title: "Validate Telegram allowlist",
      question: "Confirm `TELEGRAM_ALLOWED_USER_IDS` is configured with your trusted user IDs.",
      done: isAllowlistConfigured(container.env.allowedTelegramUsers)
    },
    {
      id: "voice-ready",
      title: "Enable voice stack (optional)",
      question: "Configure ElevenLabs and Twilio credentials for TTS and outbound calling.",
      done: voiceConfigured || twilioConfigured,
      optional: true
    },
    {
      id: "complete",
      title: "Complete onboarding",
      question: "Finalize setup and record onboarding completion for this workspace.",
      done: Boolean(completedAt)
    }
  ];

  const doneCount = steps.filter((step) => step.done || step.optional).length;
  const totalRequired = steps.filter((step) => !step.optional).length;
  const requiredDone = steps.filter((step) => !step.optional && step.done).length;
  const nextStep = steps.find((step) => !step.done && !step.optional);

  return NextResponse.json({
    workspaceId,
    workspaceName: workspace.name,
    completedAt,
    goal,
    providerCurrent,
    providerKeys: keyState,
    subAgents: subAgents.map((agent) => ({ id: agent.id, label: agent.label })),
    securityBaseline: settings,
    steps,
    progress: {
      done: requiredDone,
      total: totalRequired,
      percent: totalRequired === 0 ? 100 : Math.round((requiredDone / totalRequired) * 100),
      withOptionalDone: doneCount
    },
    nextPrompt: nextStep
      ? `Next setup step: ${nextStep.title}. ${nextStep.question}`
      : "Onboarding is complete. You can start direct, delegated, or group workflows."
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?:
      | "set-workspace-goal"
      | "set-provider-default"
      | "apply-security-baseline"
      | "create-sub-agent"
      | "complete-onboarding";
    workspaceId?: string;
    goal?: string;
    provider?: ProviderName;
    model?: string;
    label?: string;
  };

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const workspaceId = body.workspaceId ?? "default";
  const container = await getAppContainer();
  await container.lifecycle.ensureWorkspace(workspaceId);
  const workspace = await container.workspaces.get(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  if (action === "set-workspace-goal") {
    const goal = body.goal?.trim();
    if (!goal) {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }
    await container.workspaces.setConfig(workspaceId, "onboarding.primaryGoal", goal);
    container.docs.record({
      source: "onboarding",
      detail: `Set onboarding goal for workspace '${workspaceId}'.`
    });
    return NextResponse.json({ ok: true, action, goal });
  }

  if (action === "set-provider-default") {
    if (!body.provider) {
      return NextResponse.json({ error: "provider is required" }, { status: 400 });
    }
    await container.providers.setCurrent(body.provider, body.model?.trim() || undefined);
    container.docs.record({
      source: "onboarding",
      detail: `Set default provider to '${body.provider}' for workspace '${workspaceId}'.`
    });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "apply-security-baseline") {
    for (const [key, value] of Object.entries(SECURITY_BASELINE)) {
      await container.memories.setSetting(key, value);
    }
    container.docs.record({
      source: "onboarding",
      detail: `Applied security baseline settings for workspace '${workspaceId}'.`
    });
    return NextResponse.json({ ok: true, action, applied: Object.keys(SECURITY_BASELINE) });
  }

  if (action === "create-sub-agent") {
    const label = body.label?.trim() || "Worker Agent";
    try {
      const created = await container.lifecycle.createSubAgent({
        workspaceId,
        label,
        parentId: "main"
      });
      container.docs.record({
        source: "onboarding",
        detail: `Created onboarding sub-agent '${created.id}' in workspace '${workspaceId}'.`
      });
      return NextResponse.json({
        ok: true,
        action,
        agent: { id: created.id, label: created.label }
      });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    }
  }

  if (action === "complete-onboarding") {
    const keyState = container.providers.keyState();
    const providerReady = Object.values(keyState).some((entry) => entry.configured);
    if (!providerReady) {
      return NextResponse.json(
        { error: "configure at least one provider key before completing onboarding" },
        { status: 400 }
      );
    }

    const completedAt = new Date().toISOString();
    await container.workspaces.setConfig(workspaceId, "onboarding.completedAt", completedAt);
    await container.workspaces.setConfig(workspaceId, "onboarding.completedBy", "local-ui");
    container.docs.record({
      source: "onboarding",
      detail: `Completed onboarding flow for workspace '${workspaceId}'.`
    });
    return NextResponse.json({ ok: true, action, completedAt });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
