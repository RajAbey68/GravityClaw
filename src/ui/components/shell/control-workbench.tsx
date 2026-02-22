"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AgentDescriptor, AgentMode } from "@/src/core/types";
import { AgentTabs } from "@/src/ui/components/agents/agent-tabs";
import { ChatWorkspace } from "@/src/ui/components/shell/chat-workspace";
import { HomeCanvasPanel } from "@/src/ui/components/canvas/home-canvas-panel";

function titleFor(mode: AgentMode, agentId: string) {
  if (mode === "group") return "Group Room";
  if (mode === "delegated") return `Delegation Console (${agentId})`;
  return `Agent Console (${agentId})`;
}

export function ControlWorkbench() {
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("main");
  const [mode, setMode] = useState<AgentMode>("direct");
  const [roundLimit, setRoundLimit] = useState(2);
  const [coordinatorId, setCoordinatorId] = useState("main");
  const [newAgentLabel, setNewAgentLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAgents = useCallback(async () => {
    const response = await fetch("/api/agents");
    const data = (await response.json()) as { agents?: AgentDescriptor[] };
    setAgents(data.agents ?? []);
    if (data.agents?.length && !data.agents.some((agent) => agent.id === coordinatorId)) {
      setCoordinatorId(data.agents[0].id);
    }

    if (!data.agents?.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(data.agents?.[0]?.id ?? "main");
    }
  }, [selectedAgentId, coordinatorId]);

  useEffect(() => {
    loadAgents();
    const timer = window.setInterval(loadAgents, 5000);
    return () => window.clearInterval(timer);
  }, [loadAgents]);

  async function spawn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newAgentLabel.trim();
    if (!label || creating) return;
    setCreating(true);

    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, parentId: "main", isolateShortTermMemory: true })
      });
      setNewAgentLabel("");
      await loadAgents();
    } finally {
      setCreating(false);
    }
  }

  const chatMode = useMemo<AgentMode>(() => mode, [mode]);
  const chatAgentId = chatMode === "group" ? "main" : selectedAgentId;

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div className="gc-home-grid">
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <AgentTabs
            agents={agents.map((agent) => ({
              id: agent.id,
              label: agent.label,
              status: agent.status,
              parentId: agent.parentId
            }))}
            selectedAgentId={selectedAgentId}
            onSelect={setSelectedAgentId}
            interactive
          />
          <form className="gc-card" style={{ padding: "0.7rem", display: "grid", gap: "0.45rem" }} onSubmit={spawn}>
            <strong style={{ fontSize: "0.9rem" }}>Spawn Sub-Agent</strong>
            <input
              value={newAgentLabel}
              onChange={(event) => setNewAgentLabel(event.target.value)}
              placeholder="e.g. research-bot"
              style={{
                border: "1px solid var(--gc-border)",
                background: "var(--gc-bg-soft)",
                borderRadius: "10px",
                padding: "0.5rem 0.6rem"
              }}
            />
            <button
              type="submit"
              disabled={creating}
              style={{
                border: "1px solid var(--gc-primary-soft)",
                background: "rgba(25, 209, 195, 0.12)",
                borderRadius: "10px",
                padding: "0.45rem 0.6rem",
                cursor: "pointer"
              }}
            >
              {creating ? "Spawning..." : "Create"}
            </button>
          </form>
          <div className="gc-card" style={{ padding: "0.7rem", display: "grid", gap: "0.4rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>Mode</strong>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {(["direct", "delegated", "group"] as AgentMode[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  style={{
                    border: `1px solid ${mode === value ? "var(--gc-primary-soft)" : "var(--gc-border)"}`,
                    background: mode === value ? "rgba(25, 209, 195, 0.08)" : "transparent",
                    borderRadius: "9px",
                    padding: "0.4rem 0.5rem",
                    textTransform: "capitalize",
                    cursor: "pointer"
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.35rem" }}>
              <label style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Coordinator</label>
              <select
                value={coordinatorId}
                onChange={(event) => setCoordinatorId(event.target.value)}
                style={{
                  border: "1px solid var(--gc-border)",
                  borderRadius: "8px",
                  background: "var(--gc-bg-soft)",
                  padding: "0.35rem"
                }}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.id}
                  </option>
                ))}
              </select>
              <label style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Round limit</label>
              <input
                type="number"
                min={1}
                max={8}
                value={roundLimit}
                onChange={(event) => setRoundLimit(Number(event.target.value))}
                style={{
                  border: "1px solid var(--gc-border)",
                  borderRadius: "8px",
                  background: "var(--gc-bg-soft)",
                  padding: "0.35rem"
                }}
              />
            </div>
          </div>
        </div>

        <ChatWorkspace
          key={`${chatMode}-${chatAgentId}`}
          agentId={chatAgentId}
          mode={chatMode}
          title={titleFor(chatMode, chatAgentId)}
          badge={`${chatMode} | ${chatAgentId}`}
          chatId={`home:${chatMode}:${chatAgentId}`}
          roomId={`home-room:${chatMode}:${chatAgentId}`}
          roundLimit={roundLimit}
          coordinatorId={coordinatorId}
        />
      </div>
      <HomeCanvasPanel />
    </div>
  );
}
