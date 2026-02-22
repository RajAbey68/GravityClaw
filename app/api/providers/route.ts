import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import type { ProviderId } from "@/src/core/providers/types";

export async function GET() {
  const container = await getAppContainer();
  const providers = await container.providers.list();
  const current = container.providers.getCurrent();

  return NextResponse.json({
    providers,
    currentProvider: current.provider,
    currentModel: current.model,
    failoverEnabled: current.failoverEnabled,
    failoverList: current.failoverList,
    keys: container.providers.keyState()
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    provider?: ProviderId;
    model?: string;
    failoverEnabled?: boolean;
    failoverList?: Array<{ provider: ProviderId; model: string }>;
  };

  const container = await getAppContainer();
  if (typeof body.failoverEnabled === "boolean") {
    await container.providers.setFailover(body.failoverEnabled);
  }
  if (Array.isArray(body.failoverList)) {
    await container.providers.setFailoverList(body.failoverList);
  }
  if (body.provider) {
    await container.providers.setCurrent(body.provider, body.model);
  }
  if (!body.provider && typeof body.failoverEnabled !== "boolean" && !Array.isArray(body.failoverList)) {
    return NextResponse.json({ error: "provider, failoverEnabled, or failoverList is required" }, { status: 400 });
  }
  const current = container.providers.getCurrent();
  publishEvent(container.eventBus, {
    type: "provider.config.changed",
    provider: current.provider,
    model: current.model,
    failoverEnabled: current.failoverEnabled
  });
  container.docs.record({
    source: "providers",
    detail: `Provider config changed: ${current.provider}/${current.model} failover=${String(
      current.failoverEnabled
    )}.`
  });

  return NextResponse.json({
    ok: true,
    currentProvider: current.provider,
    currentModel: current.model,
    failoverEnabled: current.failoverEnabled,
    failoverList: current.failoverList
  });
}
