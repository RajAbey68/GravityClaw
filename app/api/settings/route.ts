import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

const KEYS = [
  "global.iterationLimit",
  "global.reflectionEnabled",
  "global.maxTokenLimit",
  "global.costThresholdUsd",
  "global.autoSpawnEnabled",
  "global.proactiveEnabled",
  "global.security.requireDangerousConfirmation"
];

export async function GET() {
  const container = await getAppContainer();
  const entries = await Promise.all(
    KEYS.map(async (key) => ({ key, value: await container.memories.getSetting(key) }))
  );
  return NextResponse.json({
    settings: Object.fromEntries(entries.map((entry) => [entry.key, entry.value])),
    runtime: {
      proactiveEnabled: container.proactive.isEnabled
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { settings?: Record<string, string | number | boolean> };
  if (!body.settings || typeof body.settings !== "object") {
    return NextResponse.json({ error: "settings object is required" }, { status: 400 });
  }

  const container = await getAppContainer();
  const updates = Object.entries(body.settings).filter(([key]) => KEYS.includes(key));
  await Promise.all(
    updates.map(([key, value]) => container.memories.setSetting(key, String(value)))
  );
  const proactiveToggle = updates.find(([key]) => key === "global.proactiveEnabled");
  if (proactiveToggle) {
    const enabled = ["1", "true", "yes", "on"].includes(String(proactiveToggle[1]).toLowerCase());
    container.proactive.setEnabled(enabled);
  }

  container.docs.record({
    source: "settings",
    detail: `Updated ${updates.length} global settings.`
  });
  publishEvent(container.eventBus, {
    type: "settings.updated",
    keys: updates.map(([key]) => key)
  });

  return NextResponse.json({
    ok: true,
    updated: updates.map(([key]) => key),
    proactiveEnabled: container.proactive.isEnabled
  });
}
