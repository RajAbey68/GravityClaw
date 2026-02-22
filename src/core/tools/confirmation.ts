import { randomUUID } from "node:crypto";

interface PendingConfirmation<TInput = unknown> {
  id: string;
  toolId: string;
  input: TInput;
  agentId: string;
  createdAt: string;
  expiresAt: string;
  risk: "elevated" | "dangerous";
  reason: string;
}

export class ToolConfirmationManager {
  private readonly pending = new Map<string, PendingConfirmation>();

  constructor(private readonly ttlMs = 5 * 60 * 1000) {}

  create<TInput>(params: {
    toolId: string;
    input: TInput;
    agentId: string;
    risk: "elevated" | "dangerous";
    reason: string;
  }) {
    const id = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.ttlMs);
    const entry: PendingConfirmation<TInput> = {
      id,
      toolId: params.toolId,
      input: params.input,
      agentId: params.agentId,
      risk: params.risk,
      reason: params.reason,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    this.pending.set(id, entry as PendingConfirmation);
    return entry;
  }

  list() {
    this.cleanupExpired();
    return [...this.pending.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  consume(id: string) {
    this.cleanupExpired();
    const found = this.pending.get(id);
    if (!found) {
      return undefined;
    }
    this.pending.delete(id);
    return found;
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [id, entry] of this.pending.entries()) {
      if (new Date(entry.expiresAt).getTime() <= now) {
        this.pending.delete(id);
      }
    }
  }
}
