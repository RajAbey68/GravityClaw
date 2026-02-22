import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SQLiteMemoryDB } from "@/src/core/memory/db";
import { CallRepository } from "@/src/core/memory/repositories/calls";
import { CallCoordinator } from "@/src/core/interface/voice/call-coordinator";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

describe("call coordinator", () => {
  it("supports outbound call, handoff, and speech turn routing", async () => {
    const dbPath = path.join(os.tmpdir(), `gravity-call-${Date.now()}.sqlite`);
    const db = new SQLiteMemoryDB(dbPath);
    await db.init();

    const repository = new CallRepository(db);
    const coordinator = new CallCoordinator(
      {
        async createOutboundCall() {
          return { ok: true as const, sid: "CA123" };
        }
      } as any,
      repository,
      new SystemEventBus(),
      "http://localhost:3000",
      async () => ({ finalText: "Acknowledged. I will proceed." })
    );

    const started = await coordinator.startOutboundCall({
      toNumber: "+10000000000",
      agentId: "main",
      objective: "Collect update"
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const handedOff = await coordinator.handoff(started.callId, "research-bot");
    expect(handedOff.ok).toBe(true);
    expect(handedOff.toAgentId).toBe("research-bot");

    const speech = await coordinator.onSpeechTurn({
      callId: started.callId,
      SpeechResult: "please summarize the status"
    });
    expect(speech.ok).toBe(true);
    expect(speech.twiml).toContain("<Response>");
  });
});

