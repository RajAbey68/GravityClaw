import { randomUUID } from "node:crypto";
import { TwilioAdapter } from "@/src/core/interface/voice/twilio";
import { CallRepository } from "@/src/core/memory/repositories/calls";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import type { AgentMode, CallState } from "@/src/core/types";

function mapTwilioStatus(status: string | undefined): CallState {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("ringing")) return "ringing";
  if (normalized.includes("in-progress")) return "in-progress";
  if (normalized.includes("completed")) return "completed";
  if (normalized.includes("failed") || normalized.includes("busy") || normalized.includes("no-answer")) return "failed";
  return "queued";
}

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export class CallCoordinator {
  constructor(
    private readonly twilio: TwilioAdapter,
    private readonly repository: CallRepository,
    private readonly eventBus: SystemEventBus,
    private readonly publicBaseUrl: string,
    private readonly runTask: (input: {
      agentId: string;
      message: string;
      mode: AgentMode;
      chatId: string;
      workspaceId: string;
    }) => Promise<{ finalText: string }>
  ) {}

  async startOutboundCall(input: {
    toNumber: string;
    agentId: string;
    objective: string;
    fromNumber?: string;
    workspaceId?: string;
  }) {
    const callId = randomUUID();
    await this.repository.createSession({
      id: callId,
      provider: "twilio",
      controllingAgentId: input.agentId,
      toNumber: input.toNumber,
      fromNumber: input.fromNumber,
      state: "queued",
      context: { objective: input.objective, workspaceId: input.workspaceId ?? "default" }
    });

    publishEvent(this.eventBus, {
      type: "call.session",
      callId,
      state: "queued",
      controllingAgentId: input.agentId
    });

    const twimlUrl = `${this.publicBaseUrl.replace(/\/$/, "")}/api/voice/twilio/speech?callId=${encodeURIComponent(callId)}`;
    const created = await this.twilio.createOutboundCall(input.toNumber, twimlUrl);
    if (!created.ok) {
      await this.repository.updateSession({
        id: callId,
        state: "failed"
      });
      await this.repository.addEvent(callId, "outbound-failed", { reason: created.reason });
      publishEvent(this.eventBus, {
        type: "call.session",
        callId,
        state: "failed",
        controllingAgentId: input.agentId
      });
      return { ok: false as const, callId, reason: created.reason };
    }

    await this.repository.updateSession({
      id: callId,
      sid: created.sid,
      state: "ringing"
    });
    await this.repository.addEvent(callId, "outbound-created", { sid: created.sid, objective: input.objective });

    publishEvent(this.eventBus, {
      type: "call.session",
      callId,
      state: "ringing",
      controllingAgentId: input.agentId,
      sid: created.sid
    });

    return { ok: true as const, callId, sid: created.sid };
  }

  async handoff(callId: string, toAgentId: string) {
    const current = await this.repository.getById(callId);
    if (!current) {
      throw new Error("call-not-found");
    }

    const fromAgentId = current.controllingAgentId;
    await this.repository.updateSession({
      id: callId,
      controllingAgentId: toAgentId,
      state: "handoff"
    });
    await this.repository.addEvent(callId, "handoff", { fromAgentId, toAgentId });

    publishEvent(this.eventBus, {
      type: "call.handoff",
      callId,
      fromAgentId,
      toAgentId
    });
    publishEvent(this.eventBus, {
      type: "call.session",
      callId,
      state: "handoff",
      controllingAgentId: toAgentId,
      sid: current.sid
    });

    return { ok: true, callId, fromAgentId, toAgentId };
  }

  async onStatusCallback(payload: Record<string, string>) {
    const sid = payload.CallSid;
    if (!sid) {
      return { ok: false, reason: "missing-call-sid" };
    }

    const session = await this.repository.getBySid(sid);
    if (!session) {
      return { ok: false, reason: "call-not-found" };
    }

    const nextState = mapTwilioStatus(payload.CallStatus);
    await this.repository.updateSession({
      id: session.id,
      state: nextState,
      sid
    });
    await this.repository.addEvent(session.id, "status-callback", payload);
    publishEvent(this.eventBus, {
      type: "call.session",
      callId: session.id,
      state: nextState,
      controllingAgentId: session.controllingAgentId,
      sid
    });

    return { ok: true, callId: session.id, state: nextState };
  }

  async onSpeechTurn(payload: Record<string, string>) {
    const callId = payload.callId || payload.CallSid;
    if (!callId) {
      return {
        ok: false,
        twiml: `<Response><Say>Call identifier missing.</Say></Response>`
      };
    }

    const session =
      payload.callId
        ? await this.repository.getById(payload.callId)
        : await this.repository.getBySid(payload.CallSid ?? "");

    if (!session) {
      return {
        ok: false,
        twiml: `<Response><Say>Call session not found.</Say></Response>`
      };
    }

    const text = (payload.SpeechResult ?? payload.text ?? "").trim();
    if (!text) {
      const twiml = `<Response><Gather input="speech" action="/api/voice/twilio/speech?callId=${session.id}" method="POST"><Say>I did not catch that. Please repeat.</Say></Gather></Response>`;
      return { ok: true, callId: session.id, twiml };
    }

    await this.repository.addEvent(session.id, "speech-in", { text });

    const result = await this.runTask({
      agentId: session.controllingAgentId,
      message: text,
      mode: "direct",
      chatId: `call:${session.id}`,
      workspaceId: String((session.context as { workspaceId?: string } | undefined)?.workspaceId ?? "default")
    });

    await this.repository.addEvent(session.id, "speech-out", { response: result.finalText.slice(0, 1200) });
    await this.repository.updateSession({
      id: session.id,
      state: "in-progress"
    });

    publishEvent(this.eventBus, {
      type: "call.session",
      callId: session.id,
      state: "in-progress",
      controllingAgentId: session.controllingAgentId,
      sid: session.sid
    });

    const sayText = escapeXml(result.finalText.slice(0, 1000));
    const twiml = [
      `<Response>`,
      `<Say>${sayText}</Say>`,
      `<Gather input="speech" action="/api/voice/twilio/speech?callId=${session.id}" method="POST">`,
      `<Say>Anything else?</Say>`,
      `</Gather>`,
      `</Response>`
    ].join("");

    return { ok: true, callId: session.id, twiml };
  }

  async listSessions() {
    return this.repository.listSessions();
  }
}
