"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useControlStore } from "@/src/ui/state/control-store";

interface ForgeJob {
  id: string;
  agentId: string;
  capability: string;
  stage: string;
  status: string;
  updatedAt: string;
}

export function ForgePanel() {
  const { workspaceId, events } = useControlStore();
  const [jobs, setJobs] = useState<ForgeJob[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string }>>([]);
  const [agentId, setAgentId] = useState("main");
  const [capability, setCapability] = useState("add a summarizer tool");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/forge/jobs?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { jobs?: ForgeJob[] };
    setJobs(payload.jobs ?? []);
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
    if (latest.type === "forge.job" || latest.type === "forge.approval" || latest.type === "forge.stage.changed") {
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

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = capability.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await fetch("/api/forge/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capability: value, agentId, workspaceId })
      });
      setCapability("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approve(jobId: string) {
    setBusy(true);
    try {
      await fetch(`/api/forge/jobs/${jobId}/approve`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject(jobId: string) {
    setBusy(true);
    try {
      await fetch(`/api/forge/jobs/${jobId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "manual rejection from UI" })
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.7rem" }}>
      <h2 style={{ margin: 0 }}>Forge</h2>
      <p style={{ margin: 0, color: "var(--gc-muted)" }}>
        Autonomous tool generation pipeline with sandbox validation and manual promotion gate.
      </p>
      <form onSubmit={createJob} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: "0.45rem" }}>
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.45rem" }}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              agent:{agent.id}
            </option>
          ))}
        </select>
        <input
          value={capability}
          onChange={(event) => setCapability(event.target.value)}
          placeholder="missing capability..."
          style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.45rem" }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "9px", padding: "0.45rem 0.65rem", cursor: "pointer" }}
        >
          Create Job
        </button>
      </form>
      <div style={{ display: "grid", gap: "0.4rem", maxHeight: "28vh", overflowY: "auto" }}>
        {jobs.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.78rem" }}>No forge jobs yet.</div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.45rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem" }}>
                <strong style={{ fontSize: "0.8rem" }}>{job.capability}</strong>
                <span style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>{job.status}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--gc-muted)" }}>
                {job.id} | stage={job.stage} | agent={job.agentId}
              </div>
              {job.status === "awaiting_approval" ? (
                <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.3rem" }}>
                  <button onClick={() => approve(job.id)} style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "7px", padding: "0.28rem 0.45rem", cursor: "pointer" }}>
                    Approve
                  </button>
                  <button onClick={() => reject(job.id)} style={{ border: "1px solid var(--gc-border)", borderRadius: "7px", padding: "0.28rem 0.45rem", cursor: "pointer" }}>
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
