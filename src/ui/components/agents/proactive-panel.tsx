"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AgentMode } from "@/src/core/types";
import { useControlStore } from "@/src/ui/state/control-store";

interface ProactiveRule {
  id: string;
  name: string;
  trigger_type: "pattern" | "cron";
  cron_expr: string | null;
  pattern_json: string | null;
  enabled: number;
}

export function ProactivePanel() {
  const { workspaceId, events } = useControlStore();
  const [rules, setRules] = useState<ProactiveRule[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string }>>([]);
  const [name, setName] = useState("Weekly planning assistant");
  const [triggerType, setTriggerType] = useState<"pattern" | "cron">("pattern");
  const [contains, setContains] = useState("weekly report");
  const [cronExpr, setCronExpr] = useState("*/30 * * * *");
  const [agentId, setAgentId] = useState("main");
  const [mode, setMode] = useState<AgentMode>("direct");
  const [result, setResult] = useState("idle");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/proactive/rules?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store"
    });
    const data = (await response.json()) as { rules?: ProactiveRule[] };
    setRules(data.rules ?? []);
  }, [workspaceId]);

  const loadAgents = useCallback(async () => {
    const response = await fetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { agents?: Array<{ id: string }> };
    const next = payload.agents ?? [];
    setAgents(next);
    if (next.length > 0 && !next.some((agent) => agent.id === agentId)) {
      setAgentId(next[0].id);
    }
  }, [workspaceId, agentId]);

  useEffect(() => {
    refresh();
    loadAgents();
  }, [refresh, loadAgents]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type === "proactive.task") {
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

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body =
      triggerType === "pattern"
        ? {
            name,
            triggerType,
            pattern: {
              contains,
              minOccurrences: 3,
              windowMessages: 400,
              prompt: `Proactively prepare for "${contains}" follow-up tasks.`,
              mode,
              agentId,
              workspaceId
            }
          }
        : {
            name,
            triggerType,
            cronExpr,
            pattern: {
              prompt: "Run scheduled proactive planning summary.",
              mode,
              agentId,
              workspaceId
            }
          };

    const response = await fetch("/api/proactive/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    setResult(JSON.stringify(await response.json()));
    await refresh();
  }

  async function runNow() {
    const response = await fetch("/api/proactive/run", { method: "POST" });
    setResult(JSON.stringify(await response.json()));
  }

  return (
    <section className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.65rem" }}>
      <h2 style={{ margin: 0 }}>Proactive Engine</h2>
      <p style={{ margin: 0, color: "var(--gc-muted)" }}>
        Pattern and cron-triggered autonomous task initiation with bounded orchestrator execution.
      </p>
      <form onSubmit={createRule} style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 1fr auto auto", gap: "0.4rem" }}>
        <input value={name} onChange={(event) => setName(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }} />
        <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as "pattern" | "cron")} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }}>
          <option value="pattern">pattern</option>
          <option value="cron">cron</option>
        </select>
        {triggerType === "pattern" ? (
          <input value={contains} onChange={(event) => setContains(event.target.value)} placeholder="contains phrase" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }} />
        ) : (
          <input value={cronExpr} onChange={(event) => setCronExpr(event.target.value)} placeholder="*/30 * * * *" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }} />
        )}
        <button type="submit" style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "8px", padding: "0.4rem 0.5rem", cursor: "pointer" }}>
          Create
        </button>
        <button type="button" onClick={runNow} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem 0.5rem", cursor: "pointer" }}>
          Run Now
        </button>
      </form>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              agent:{agent.id}
            </option>
          ))}
        </select>
        <select value={mode} onChange={(event) => setMode(event.target.value as AgentMode)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }}>
          <option value="direct">mode:direct</option>
          <option value="delegated">mode:delegated</option>
          <option value="group">mode:group</option>
        </select>
      </div>
      <div style={{ display: "grid", gap: "0.35rem", maxHeight: "20vh", overflowY: "auto" }}>
        {rules.map((rule) => (
          <div key={rule.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ fontSize: "0.8rem" }}>{rule.name}</strong>
              <span style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>{rule.trigger_type}</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--gc-muted)" }}>
              {rule.id}
            </div>
          </div>
        ))}
      </div>
      <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--gc-muted)", whiteSpace: "pre-wrap" }}>{result}</pre>
    </section>
  );
}
