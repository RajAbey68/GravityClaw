import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SQLiteMemoryDB } from "@/src/core/memory/db";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";

describe("memory archival", () => {
  it("archives older short-term entries beyond keepLatest", async () => {
    const dbPath = path.join(os.tmpdir(), `gravity-archival-${Date.now()}.sqlite`);
    const db = new SQLiteMemoryDB(dbPath);
    await db.init();
    const repo = new MemoryRepository(db);

    for (let i = 0; i < 18; i += 1) {
      await repo.addShortTerm("agent-a", `message-${i}`);
    }

    const archived = await repo.archiveShortTerm("agent-a", 5);
    expect(archived).toBe(13);

    const rows = await repo.list("agent-a", 50);
    const archivalRows = rows.filter((row) => row.kind === "archival");
    const shortTermRows = rows.filter((row) => row.kind === "short-term");

    expect(archivalRows.length).toBe(13);
    expect(shortTermRows.length).toBe(5);
  });
});
