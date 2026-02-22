import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";

const execAsync = promisify(exec);

interface ShellExecInput {
  command: string;
  timeout_ms?: number;
  cwd?: string;
}

interface ShellExecOutput {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const CHAIN_OPERATORS = ["&&", "||", ";", "|", "&", ">", "<", "`", "$("];

const BLOCK_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/f\b/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  />\s*\/dev\//i,
  /\bnet\s+user\b/i,
  /\bnet\s+localgroup\b/i
];

const DEFAULT_ALLOWED_PREFIXES = [
  "npm",
  "npx",
  "node",
  "tsc",
  "tsx",
  "python",
  "python3",
  "pip",
  "git",
  "ls",
  "dir",
  "cat",
  "type",
  "echo",
  "rg",
  "Get-ChildItem",
  "Get-Content",
  "Select-String"
];

function firstToken(command: string) {
  return command.trim().split(/\s+/)[0] ?? "";
}

function hasChaining(command: string) {
  return CHAIN_OPERATORS.some((op) => command.includes(op));
}

function isBlocked(command: string) {
  if (hasChaining(command)) return true;
  return BLOCK_PATTERNS.some((pattern) => pattern.test(command));
}

function withinWorkspace(candidate: string) {
  const root = path.resolve(process.cwd());
  const absolute = path.resolve(candidate);
  return absolute.startsWith(root);
}

export function createShellExecTool(
  allowedPrefixes = process.env.TOOL_SHELL_ALLOWED_PREFIXES
    ? process.env.TOOL_SHELL_ALLOWED_PREFIXES.split(",").map((item) => item.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_PREFIXES
): ToolDefinition<ShellExecInput, ShellExecOutput> {
  return {
    id: "shell_exec",
    description: "Execute a shell command with allowlist and timeout controls.",
    risk: "dangerous",
    async execute(input: ShellExecInput, _ctx: ToolExecutionContext) {
      const command = input.command?.trim();
      if (!command) {
        throw new Error("command is required");
      }
      if (isBlocked(command)) {
        throw new Error("blocked command pattern");
      }

      const token = firstToken(command);
      if (!allowedPrefixes.includes(token)) {
        throw new Error(`command prefix '${token}' is not allowlisted`);
      }

      const timeoutMs = Math.max(1000, Math.min(input.timeout_ms ?? 30_000, 180_000));
      const cwd = input.cwd ? path.resolve(input.cwd) : process.cwd();
      if (!withinWorkspace(cwd)) {
        throw new Error("cwd must be inside workspace root");
      }

      try {
        const result = await execAsync(command, {
          cwd,
          timeout: timeoutMs,
          maxBuffer: 2 * 1024 * 1024
        });
        return {
          ok: true,
          stdout: result.stdout.slice(-200_000),
          stderr: result.stderr.slice(-200_000),
          exitCode: 0,
          timedOut: false
        };
      } catch (error) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          code?: number | string;
          signal?: string;
          killed?: boolean;
        };
        const timeoutHit = execError.signal === "SIGTERM" || execError.killed === true;
        return {
          ok: false,
          stdout: String(execError.stdout ?? "").slice(-200_000),
          stderr: String(execError.stderr ?? "").slice(-200_000),
          exitCode: typeof execError.code === "number" ? execError.code : 1,
          timedOut: timeoutHit
        };
      }
    }
  };
}
