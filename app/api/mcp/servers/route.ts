import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

interface IncomingMCPConfig {
  servers?: Record<
    string,
    {
      type: "stdio" | "sse";
      command?: string;
      args?: string[];
      url?: string;
    }
  >;
}

const CONFIG_PATH = path.resolve(process.cwd(), "mcp.json");

function sanitizeConfig(input: IncomingMCPConfig) {
  const servers: NonNullable<IncomingMCPConfig["servers"]> = {};
  for (const [name, config] of Object.entries(input.servers ?? {})) {
    const safeName = name.trim();
    if (!safeName) continue;
    if (config.type === "stdio") {
      if (!config.command?.trim()) continue;
      servers[safeName] = {
        type: "stdio",
        command: config.command.trim(),
        args: Array.isArray(config.args) ? config.args.map((arg) => String(arg)) : []
      };
      continue;
    }
    if (!config.url?.trim()) continue;
    servers[safeName] = {
      type: "sse",
      url: config.url.trim()
    };
  }
  return { servers };
}

export async function GET() {
  const container = await getAppContainer();
  const servers = container.mcp.listServers();
  return NextResponse.json({
    enabled: container.mcp.isEnabled,
    servers
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "reload" | "save";
    config?: IncomingMCPConfig;
  };
  const container = await getAppContainer();

  if (body.action === "save") {
    const cleaned = sanitizeConfig(body.config ?? {});
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
  }

  const servers = await container.mcp.reload(container.tools);
  publishEvent(container.eventBus, {
    type: "system.info",
    detail: `MCP servers reloaded (${servers.length}).`
  });
  container.docs.record({
    source: "mcp",
    detail: `Reloaded MCP bridge with ${servers.length} server(s).`
  });

  return NextResponse.json({
    ok: true,
    enabled: container.mcp.isEnabled,
    servers
  });
}
