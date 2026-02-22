import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQLiteMemoryDB } from "@/src/core/memory/db";
import { ForgeRepository } from "@/src/core/memory/repositories/forge";
import { ToolRegistry } from "@/src/core/tools/registry";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { ForgeController } from "@/src/core/forge/forge-controller";

describe("forge controller", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      text: async () => ""
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("creates and approves a forge job with generated tool registration", async () => {
    const dbPath = path.join(os.tmpdir(), `gravity-forge-${Date.now()}.sqlite`);
    const db = new SQLiteMemoryDB(dbPath);
    await db.init();

    const repository = new ForgeRepository(db);
    const tools = new ToolRegistry();
    const forge = new ForgeController(
      new SystemEventBus(),
      true,
      repository,
      tools,
      {
        async recordFileWrite(input: { targetPath: string; content: string }) {
          const absolute = path.resolve(process.cwd(), input.targetPath);
          fs.mkdirSync(path.dirname(absolute), { recursive: true });
          fs.writeFileSync(absolute, input.content, "utf8");
          return { diffPath: "data/audit-diffs/mock.diff", currHash: "mock-hash" };
        }
      } as any,
      {
        record() {
          return undefined;
        }
      } as any
    );
    await forge.init();

    const created = await forge.createManualJob({
      agentId: "main",
      capability: "prepare outbound status digest"
    });
    expect(created.jobId).toBeTruthy();

    const jobs = await forge.listJobs();
    const job = jobs.find((entry) => entry.id === created.jobId);
    expect(job?.status).toBe("awaiting_approval");

    const approved = await forge.approveJob(created.jobId, "main");
    expect(approved.ok).toBe(true);
    expect(tools.has(approved.toolId)).toBe(true);
  }, 20000);
});
