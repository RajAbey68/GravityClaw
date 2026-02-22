import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SQLiteMemoryDB } from "@/src/core/memory/db";
import { SessionRepository } from "@/src/core/memory/repositories/sessions";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";
import { ContextAssembler } from "@/src/core/runtime/context-assembler";

describe("context assembler", () => {
  it("keeps latest user message at the end and injects memory", async () => {
    const dbPath = path.join(os.tmpdir(), `gravity-context-${Date.now()}.sqlite`);
    const db = new SQLiteMemoryDB(dbPath);
    await db.init();

    const sessions = new SessionRepository(db);
    const memories = new MemoryRepository(db);

    await sessions.ensure("ui:local:main", "main", "ui");
    await sessions.addMessage("ui:local:main", "user", "previous user msg");
    await sessions.addMessage("ui:local:main", "assistant", "previous assistant msg");
    await memories.add("main", "long-term", "new task should use concise response format");

    const assembler = new ContextAssembler(sessions, memories);
    const assembled = await assembler.assemble("ui:local:main", "new task");

    expect(assembled.systemPrompt).toContain("response format");
    expect(assembled.messages[assembled.messages.length - 1].content).toBe("new task");

  });
});
