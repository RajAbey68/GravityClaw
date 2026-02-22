"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useControlStore } from "@/src/ui/state/control-store";
import { LiveFeed } from "@/src/ui/components/live-feed/LiveFeed";

interface DashboardPayload {
  activeAgents: number;
  runningLoops: number;
  activeSubAgents: number;
  rooms: number;
  currentProvider: { provider: string; model: string; failoverEnabled: boolean };
  providerKeys: Record<string, { configured: boolean; masked: string }>;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; requests: number };
  memory: {
    total: number;
    shortTerm: number;
    longTerm: number;
    archival: number;
    compressed: number;
    pinned: number;
    bytes: number;
    namespaces: number;
  };
  totalCalls: number;
  systemHealth: { nodeUptimeSeconds: number; rssMb: number; heapUsedMb: number; loadAvg: number[] };
  subAgentTree: Array<{ id: string; parentId: string | null; status: string }>;
  recentForgeEvents: Array<{ id: string; capability: string; stage: string; status: string; updatedAt: string }>;
  recentDelegations: Array<{ id: string; parent_agent_id: string; target_agent_id: string; objective: string; status: string; updated_at: string }>;
  proactiveRules: Array<{ id: string; name: string; trigger_type: string; enabled: number }>;
  toolUsage: Array<{ tool_id: string; total: number }>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DashboardPage() {
  const { workspaceId, events } = useControlStore();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
      const payload = (await response.json()) as DashboardPayload;
      setData(payload);
    } catch {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if ([
      "agent.step.started",
      "agent.step.completed",
      "agent.spawned",
      "agent.status.changed",
      "provider.usage.updated",
      "provider.config.changed",
      "tool.called",
      "tool.completed",
      "forge.stage.changed",
      "delegation.created",
      "delegation.completed",
      "proactive.task",
      "call.session",
      "settings.updated",
      "memory.write"
    ].includes(latest.type)) {
      load();
    }
  }, [events, load]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Active Agents", value: data.activeAgents.toString(), href: "/agents" },
      { label: "Running Loops", value: data.runningLoops.toString(), href: "/canvas" },
      { label: "Current Provider", value: `${data.currentProvider.provider}/${data.currentProvider.model}`, href: "/providers" },
      { label: "Token Usage", value: `${data.usage.inputTokens + data.usage.outputTokens}`, href: "/logs" },
      { label: "Estimated Cost", value: `$${data.usage.estimatedCostUsd.toFixed(4)}`, href: "/providers" },
      { label: "Memory Entries", value: data.memory.total.toString(), href: "/memory" },
      { label: "Sub-Agents", value: data.activeSubAgents.toString(), href: "/agents" },
      { label: "Calls", value: data.totalCalls.toString(), href: "/settings" },
      { label: "Proactive Rules", value: data.proactiveRules.length.toString(), href: "/settings" }
    ];
  }, [data]);

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <section className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>System Dashboard</h1>
          <span className="gc-badge">ws:{workspaceId}</span>
        </div>
        <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", maxWidth: "800px" }}>
          High-precision orchestration metrics. Live telemetry tracks provider usage, memory evolution, 
          autonomous forge activity, and multi-agent delegation streams.
        </div>
      </section>

      {loading ? (
        <section className="gc-card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--gc-muted)" }}>
          Synchronizing telemetry dashboard...
        </section>
      ) : null}
      
      {error ? (
        <section className="gc-card" style={{ padding: "1.5rem", color: "var(--gc-danger)", background: "rgba(255, 94, 94, 0.05)" }}>
          {error}
        </section>
      ) : null}

      {!loading && data ? (
        <>
          {/* Key Metrics Grid */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {cards.map((card) => (
              <Link key={card.label} href={card.href} className="gc-card gc-card-interactive" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {card.label}
                </div>
                <div style={{ marginTop: "0.4rem", fontSize: "1.4rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--gc-primary)" }}>
                  {card.value}
                </div>
              </Link>
            ))}
          </section>

          {/* Activity Streams */}
          <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "1rem" }}>
            <div className="gc-card" style={{ padding: "1.2rem" }}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: "0.95rem" }}>Agent Mesh Hierarchy</strong>
                <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>{data.subAgentTree.length} active</span>
              </div>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {data.subAgentTree.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center", border: "1px dashed var(--gc-border)", borderRadius: "8px", color: "var(--gc-muted)", fontSize: "0.8rem" }}>
                    No active sub-agents in this workspace.
                  </div>
                ) : (
                  data.subAgentTree.map((node) => (
                    <Link
                      href={`/agents?agentId=${encodeURIComponent(node.id)}`}
                      key={node.id}
                      className="gc-card-interactive"
                      style={{
                        border: "1px solid var(--gc-border)",
                        borderRadius: "8px",
                        padding: "0.5rem 0.75rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                        {node.parentId ? (
                          <span style={{ color: "var(--gc-muted)" }}>{node.parentId.slice(0, 8)}/</span>
                        ) : null}
                        {node.id.slice(0, 12)}
                      </span>
                      <span className="gc-badge" style={{ fontSize: "0.6rem" }}>{node.status}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.2rem" }}>
              <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: "1rem" }}>Forge Capability Jobs</strong>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {data.recentForgeEvents.length === 0 ? (
                  <div style={{ color: "var(--gc-muted)", fontSize: "0.8rem" }}>Awaiting forge triggers...</div>
                ) : (
                  data.recentForgeEvents.map((job) => (
                    <Link key={job.id} href="/skills" className="gc-card-interactive" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.5rem" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{job.capability}</div>
                      <div style={{ color: "var(--gc-muted)", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                        {job.stage} • {job.status}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.2rem" }}>
              <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: "1rem" }}>Delegation Matrix</strong>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {data.recentDelegations.length === 0 ? (
                  <div style={{ color: "var(--gc-muted)", fontSize: "0.8rem" }}>No active handoffs.</div>
                ) : (
                  data.recentDelegations.map((task) => (
                    <Link key={task.id} href="/chat" className="gc-card-interactive" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.5rem" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                        {task.parent_agent_id.slice(0, 6)} → {task.target_agent_id.slice(0, 6)}
                      </div>
                      <div style={{ color: "var(--gc-muted)", fontSize: "0.72rem", marginTop: "0.15rem" }}>{task.status}</div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Deep Health & Infrastructure */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            <div className="gc-card" style={{ padding: "1.2rem" }}>
              <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.8rem" }}>Node.js Runtime Health</strong>
              <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Uptime</span>
                  <span>{Math.floor(data.systemHealth.nodeUptimeSeconds / 3600)}h {Math.floor((data.systemHealth.nodeUptimeSeconds % 3600) / 60)}m</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>RSS Memory</span>
                  <span>{data.systemHealth.rssMb} MB</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Heap Tension</span>
                  <span>{data.systemHealth.heapUsedMb} MB</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Load Avg (1/5/15)</span>
                  <span>{data.systemHealth.loadAvg.map(n => n.toFixed(2)).join(" ")}</span>
                </div>
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.2rem" }}>
              <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: "0.8rem" }}>Memory Evolution Footprint</strong>
              <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Total Vector Entries</span>
                  <span>{data.memory.total}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Episodic / Semantic</span>
                  <span>{data.memory.shortTerm} / {data.memory.longTerm}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Pinned (Cognitive Core)</span>
                  <span>{data.memory.pinned}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--gc-muted)" }}>Storage Hydration</span>
                  <span>{formatBytes(data.memory.bytes)}</span>
                </div>
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.2rem" }}>
              <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: "0.8rem" }}>Heuristic Tool Usage</strong>
              <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }}>
                {data.toolUsage.length === 0 ? (
                  <div style={{ color: "var(--gc-muted)", padding: "1rem", textAlign: "center" }}>No usage data available.</div>
                ) : (
                  data.toolUsage.slice(0, 5).map((entry) => (
                    <div key={entry.tool_id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--gc-primary)" }}>{entry.tool_id}</span>
                      <span>{entry.total}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Setup Progress */}
          <section className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
            <strong style={{ fontSize: "1rem" }}>Infrastructure Readiness</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.8rem" }}>
              {[
                {
                  done: Object.values(data.providerKeys).some((entry) => entry?.configured) && data.activeAgents > 1,
                  label: "Orchestration Onboarding",
                  detail: "Complete the master setup wizard",
                  href: "/onboarding"
                },
                {
                  done: Object.values(data.providerKeys).some((entry) => entry?.configured),
                  label: "LLM Connectivity",
                  detail: "Connect provider API endpoints",
                  href: "/providers"
                },
                {
                  done: data.activeAgents > 1,
                  label: "Agent Deployment",
                  detail: "Instantiate primary or sub-agents",
                  href: "/agents"
                },
                {
                  done: data.recentForgeEvents.length > 0,
                  label: "Skill Synthesis",
                  detail: "Generate first autonomous capability",
                  href: "/settings"
                }
              ].map((item) => (
                <Link key={item.label} href={item.href} className="gc-card-interactive" style={{ 
                  border: "1px solid var(--gc-border)", 
                  borderRadius: "10px", 
                  padding: "0.8rem", 
                  display: "flex", 
                  flexDirection: "column",
                  gap: "0.25rem" 
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.label}</span>
                    <span style={{ color: item.done ? "var(--gc-primary)" : "var(--gc-muted)", fontSize: "0.7rem", fontWeight: 700 }}>
                      {item.done ? "DEPLOYED" : "PENDING"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--gc-muted)" }}>{item.detail}</div>
                </Link>
              ))}
            </div>
          </section>

          {/* Real-time System Stream */}
          <section className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
            <LiveFeed workspaceId={workspaceId} maxHeight="400px" />
          </section>
        </>
      ) : null}
    </div>
  );
}

