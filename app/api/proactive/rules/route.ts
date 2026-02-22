import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

function ruleWorkspace(patternJson: string | null) {
  if (!patternJson) return "default";
  try {
    const parsed = JSON.parse(patternJson) as { workspaceId?: string };
    return parsed.workspaceId?.trim() || "default";
  } catch {
    return "default";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const container = await getAppContainer();
  const rules = await container.proactive.listRules();
  const filtered = workspaceId ? rules.filter((rule) => ruleWorkspace(rule.pattern_json) === workspaceId) : rules;
  return NextResponse.json({ rules: filtered });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    triggerType?: "pattern" | "cron";
    cronExpr?: string;
    pattern?: Record<string, unknown>;
    enabled?: boolean;
  };

  const name = body.name?.trim();
  if (!name || !body.triggerType) {
    return NextResponse.json({ error: "name and triggerType are required" }, { status: 400 });
  }

  const container = await getAppContainer();
  const created = await container.proactive.createRule({
    name,
    triggerType: body.triggerType,
    cronExpr: body.cronExpr,
    pattern: body.pattern,
    enabled: body.enabled
  });
  publishEvent(container.eventBus, {
    type: "proactive.task",
    taskId: created.id,
    trigger: body.triggerType,
    status: "rule-created"
  });

  return NextResponse.json({ ok: true, ...created });
}
