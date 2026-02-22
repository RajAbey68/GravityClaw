"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useControlStore } from "@/src/ui/state/control-store";

interface CallSession {
  id: string;
  sid?: string;
  controllingAgentId: string;
  state: string;
  toNumber: string;
}

interface AgentRecord {
  id: string;
}

export function CallPanel() {
  const { workspaceId, events } = useControlStore();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [toNumber, setToNumber] = useState("+10000000000");
  const [objective, setObjective] = useState("Discuss project status and collect action items.");
  const [agentId, setAgentId] = useState("main");
  const [handoffAgent, setHandoffAgent] = useState("main");
  const [result, setResult] = useState("idle");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/voice/calls?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as { calls?: CallSession[] };
    setCalls(payload.calls ?? []);
  }, [workspaceId]);

  const loadAgents = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
      const data = (await response.json()) as { agents?: AgentRecord[] };
      const next = data.agents ?? [];
      setAgents(next);
      if (next.length > 0) {
        setAgentId((current) =>
          next.some((agent) => agent.id === current) ? current : next[0].id
        );
        setHandoffAgent((current) =>
          next.some((agent) => agent.id === current) ? current : next[0].id
        );
      }
    } catch {
      setAgents([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
    loadAgents();
  }, [workspaceId, refresh, loadAgents]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type === "call.session" || latest.type === "call.handoff") {
      refresh();
      return;
    }
    if (latest.type === "agent.spawned" || latest.type === "agent.status.changed") {
      const eventWorkspace = typeof latest.workspaceId === "string" ? latest.workspaceId : undefined;
      if (!eventWorkspace || eventWorkspace === workspaceId) {
        loadAgents();
      }
    }
  }, [events, workspaceId, refresh, loadAgents]);

  async function startCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/voice/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toNumber, objective, agentId, workspaceId })
    });
    setResult(JSON.stringify(await response.json()));
    await refresh();
  }

  async function handoff(callId: string) {
    const response = await fetch(`/api/voice/calls/${callId}/handoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toAgentId: handoffAgent })
    });
    setResult(JSON.stringify(await response.json()));
    await refresh();
  }

  return (
    <section className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.65rem" }}>
      <h2 style={{ margin: 0 }}>Voice Calls</h2>
      <p style={{ margin: 0, color: "var(--gc-muted)" }}>
        Twilio outbound calls with controllable agent handoff and call-session telemetry.
      </p>
      <form onSubmit={startCall} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr auto", gap: "0.4rem" }}>
        <input value={toNumber} onChange={(event) => setToNumber(event.target.value)} placeholder="+1..." style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }} />
        <input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="call objective" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }} />
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.id}
            </option>
          ))}
        </select>
        <button type="submit" style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "8px", padding: "0.4rem 0.5rem", cursor: "pointer" }}>
          Start
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "0.8fr auto", gap: "0.35rem" }}>
        <select value={handoffAgent} onChange={(event) => setHandoffAgent(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.id}
            </option>
          ))}
        </select>
        <button type="button" onClick={refresh} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem 0.5rem", cursor: "pointer" }}>
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gap: "0.35rem", maxHeight: "20vh", overflowY: "auto" }}>
        {calls.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.78rem" }}>No calls yet.</div>
        ) : (
          calls.map((call) => (
            <div key={call.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.42rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "0.8rem" }}>{call.toNumber}</strong>
                <span style={{ color: "var(--gc-muted)", fontSize: "0.72rem" }}>{call.state}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--gc-muted)" }}>
                {call.id} | controller={call.controllingAgentId}
              </div>
              <button onClick={() => handoff(call.id)} style={{ marginTop: "0.25rem", border: "1px solid var(--gc-primary-soft)", borderRadius: "7px", padding: "0.25rem 0.4rem", cursor: "pointer" }}>
                Handoff to {handoffAgent}
              </button>
            </div>
          ))
        )}
      </div>
      <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--gc-muted)", whiteSpace: "pre-wrap" }}>{result}</pre>
    </section>
  );
}
