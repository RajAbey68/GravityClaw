import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { ToolRegistry } from "@/src/core/tools/registry";

type MCPTransportType = "stdio" | "sse";

interface MCPServerConfig {
  type: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
}

interface MCPConfig {
  servers?: Record<string, MCPServerConfig>;
}

interface MCPServerRuntime {
  name: string;
  config: MCPServerConfig;
  toolId: string;
  status: "ready" | "invalid" | "disabled";
  detail?: string;
}

interface MCPExecInput {
  payload?: string;
  args?: string[];
  timeout_ms?: number;
}

function toToolId(serverName: string) {
  return `mcp_${serverName.replace(/[^a-zA-Z0-9_]/g, "_")}_exec`;
}

function withTimeout<T>(executor: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("MCP execution timed out")), timeoutMs);
  });
  return Promise.race([executor, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function runCommand(config: MCPServerConfig, input: MCPExecInput) {
  if (!config.command) {
    throw new Error("missing command");
  }

  const baseArgs = Array.isArray(config.args) ? config.args : [];
  const extraArgs = Array.isArray(input.args) ? input.args : [];
  const finalArgs = [...baseArgs, ...extraArgs];

  return withTimeout(
    new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn(config.command as string, finalArgs, {
        shell: false,
        stdio: "pipe"
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolve({
          stdout: stdout.slice(-500_000),
          stderr: stderr.slice(-500_000),
          exitCode: code ?? 0
        });
      });

      if (input.payload) {
        child.stdin.write(input.payload);
      }
      child.stdin.end();
    }),
    Math.max(1_000, Math.min(input.timeout_ms ?? 20_000, 120_000))
  );
}

async function callSse(config: MCPServerConfig, input: MCPExecInput) {
  if (!config.url) {
    throw new Error("missing url");
  }
  const response = await withTimeout(
    fetch(config.url, {
      method: input.payload ? "POST" : "GET",
      headers: {
        "content-type": "application/json"
      },
      body: input.payload ? input.payload : undefined
    }),
    Math.max(1_000, Math.min(input.timeout_ms ?? 20_000, 60_000))
  );
  const text = await response.text();
  return {
    stdout: text.slice(-500_000),
    stderr: "",
    exitCode: response.ok ? 0 : response.status
  };
}

export class MCPBridge {
  private readonly configPath = path.resolve(process.cwd(), "mcp.json");
  private servers: MCPServerRuntime[] = [];

  constructor(private readonly enabled: boolean) {}

  get isEnabled() {
    return this.enabled;
  }

  listServers() {
    return this.servers.map((server) => ({
      name: server.name,
      type: server.config.type,
      toolId: server.toolId,
      status: server.status,
      detail: server.detail
    }));
  }

  async init(toolRegistry: ToolRegistry) {
    if (!this.enabled) {
      this.servers = [];
      return;
    }
    await this.reload(toolRegistry);
  }

  async reload(toolRegistry: ToolRegistry) {
    if (!this.enabled) {
      this.servers = [];
      return this.listServers();
    }

    if (!fs.existsSync(this.configPath)) {
      this.servers = [];
      return this.listServers();
    }

    const raw = fs.readFileSync(this.configPath, "utf8");
    let parsed: MCPConfig = {};
    try {
      parsed = JSON.parse(raw) as MCPConfig;
    } catch (error) {
      this.servers = [
        {
          name: "invalid-config",
          config: { type: "stdio" },
          toolId: "mcp_invalid_exec",
          status: "invalid",
          detail: `Invalid mcp.json: ${(error as Error).message}`
        }
      ];
      return this.listServers();
    }

    const runtimes: MCPServerRuntime[] = [];
    for (const [name, config] of Object.entries(parsed.servers ?? {})) {
      const toolId = toToolId(name);
      let status: MCPServerRuntime["status"] = "ready";
      let detail = "";
      if (!config?.type || !["stdio", "sse"].includes(config.type)) {
        status = "invalid";
        detail = "unsupported transport type";
      } else if (config.type === "stdio" && !config.command) {
        status = "invalid";
        detail = "missing command";
      } else if (config.type === "sse" && !config.url) {
        status = "invalid";
        detail = "missing url";
      }

      runtimes.push({
        name,
        config,
        toolId,
        status,
        detail
      });

      if (status !== "ready") {
        continue;
      }

      if (!toolRegistry.has(toolId)) {
        const tool: ToolDefinition<MCPExecInput, { stdout: string; stderr: string; exitCode: number }> = {
          id: toolId,
          description: `Execute MCP bridge command for server '${name}'.`,
          risk: "elevated",
          execute: async (input: MCPExecInput, _ctx: ToolExecutionContext) => {
            if (config.type === "stdio") {
              return runCommand(config, input);
            }
            return callSse(config, input);
          }
        };
        toolRegistry.register(tool);
      }
    }
    this.servers = runtimes;
    return this.listServers();
  }
}
