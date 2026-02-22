"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveEvent } from "@/src/ui/components/shell/use-system-events";

interface CanvasState {
  hierarchy: Array<{ id: string; parentId: string | null; status: string }>;
  rooms: Array<{ id: string; mode: string; coordinator_id: string; round_limit: number; status: string }>;
  forgeJobs: Array<{ id: string; stage: string; status: string; capability: string; agentId: string }>;
  calls: Array<{ id: string; state: string; controllingAgentId: string; toNumber: string }>;
  usage: {
    provider: {
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      requests: number;
    };
    toolUsage: Array<{ tool_id: string; total: number }>;
  };
  memoryReadEvents: number;
}

function graphLines(hierarchy: CanvasState["hierarchy"]) {
  if (!hierarchy || hierarchy.length === 0) {
    return ["main"];
  }

  const roots = hierarchy.filter((node) => !node.parentId || node.parentId === "main");
  const lines = ["main"];
  for (const node of roots) {
    if (node.id === "main") continue;
    lines.push(`|- ${node.id} (${node.status})`);
  }
  return lines;
}

export function UniversalCanvas({ events }: { events: LiveEvent[] }) {
  const [state, setState] = useState<CanvasState | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/canvas/state")
        .then((response) => response.json())
        .then((data: CanvasState) => setState(data))
        .catch(() => setState(null));
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const latestStep = useMemo(
    () => events.find((event) => event.type === "agent.step"),
    [events]
  );

  const activeAgents = state?.hierarchy.filter((node) => node.status !== "idle").length ?? 0;
  const totalToolCalls = (state?.usage.toolUsage ?? []).reduce((sum, row) => sum + row.total, 0);
  const openForge = (state?.forgeJobs ?? []).filter((job) => job.status !== "completed" && job.status !== "rejected").length;
  const activeRooms = (state?.rooms ?? []).filter((room) => room.status === "active").length;

  return (
    <div className="gc-card" style={{ padding: "0.9rem", minHeight: "260px", display: "grid", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
        <strong>Universal Canvas</strong>
        <span className="gc-badge">Live L7</span>
      </div>
      <div style={{ fontSize: "0.82rem", color: "var(--gc-muted)" }}>
        Active graph telemetry for agents, rounds, tool/cost usage, memory reads, forge, and call sessions.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Active agents</div>
          <div>{activeAgents}</div>
        </div>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Current step</div>
          <div>{(latestStep as any)?.detail ?? "idle"}</div>
        </div>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Tool calls</div>
          <div>{totalToolCalls}</div>
        </div>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Provider cost</div>
          <div>${(state?.usage.provider.estimatedCostUsd ?? 0).toFixed(4)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Active rooms</div>
          <div>{activeRooms}</div>
        </div>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Memory reads</div>
          <div>{state?.memoryReadEvents ?? 0}</div>
        </div>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Forge open</div>
          <div>{openForge}</div>
        </div>
        <div className="gc-card" style={{ padding: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>Calls</div>
          <div>{state?.calls.length ?? 0}</div>
        </div>
      </div>

      <div className="gc-card" style={{ padding: "0.55rem" }}>
        <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)", marginBottom: "0.2rem" }}>Agent hierarchy graph</div>
        {graphLines(state?.hierarchy ?? []).map((line) => (
          <div key={line} style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

