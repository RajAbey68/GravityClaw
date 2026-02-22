import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

export interface TerminalSession {
  id: string;
  agentId: string;
  process: ChildProcess;
  output: string[];
  lastUsedAt: number;
}

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();

  async getSession(agentId: string, shell = process.platform === "win32" ? "powershell.exe" : "bash"): Promise<TerminalSession> {
    const existing = this.sessions.get(agentId);
    if (existing && !existing.process.killed) {
      existing.lastUsedAt = Date.now();
      return existing;
    }

    const id = randomUUID();
    // Using standard child_process.spawn for now as a stable fallback for PTY-like behavior
    // Real PTY (node-pty) would be better but requires native compilation
    const proc = spawn(shell, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, TERM: 'xterm-256color' },
      shell: true
    });

    const session: TerminalSession = {
      id,
      agentId,
      process: proc,
      output: [],
      lastUsedAt: Date.now()
    };

    proc.stdout?.on("data", (data) => {
      session.output.push(data.toString());
      if (session.output.length > 1000) session.output.shift();
    });

    proc.stderr?.on("data", (data) => {
      session.output.push(data.toString());
      if (session.output.length > 1000) session.output.shift();
    });

    this.sessions.set(agentId, session);
    return session;
  }

  async sendInput(agentId: string, input: string): Promise<string> {
    const session = await this.getSession(agentId);
    return new Promise((resolve, reject) => {
      if (!session.process.stdin) {
        return reject(new Error("Stdin not available"));
      }

      session.process.stdin.write(input + "\n", (err) => {
        if (err) reject(err);
        else {
          // Wait a bit for immediate response
          setTimeout(() => {
            resolve(session.output.join(""));
          }, 500);
        }
      });
    });
  }

  async closeSession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (session) {
      session.process.kill();
      this.sessions.delete(agentId);
    }
  }

  async closeAll(): Promise<void> {
    for (const agentId of this.sessions.keys()) {
      await this.closeSession(agentId);
    }
  }
}
