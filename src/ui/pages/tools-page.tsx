"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore } from "@/src/ui/state/control-store";

interface ToolRecord {
  id: string;
  description: string;
  risk: "safe" | "elevated" | "dangerous";
  invocations: number;
  enabled: boolean;
  requireConfirmation: boolean;
  sandboxed: boolean;
}

interface ToolLogRow {
  id: number;
  session_key: string;
  tool_id: string;
  risk: string;
  status: string;
  detail: string | null;
  created_at: string;
}

export function ToolsPage() {
  const { events } = useControlStore();
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [logs, setLogs] = useState<ToolLogRow[]>([]);
  const [selectedTool, setSelectedTool] = useState("");
  const [status, setStatus] = useState("");
  const [pendingConfirmations, setPendingConfirmations] = useState<Array<{ id: string; toolId: string; expiresAt: string }>>([]);

  const load = useCallback(async (toolId?: string) => {
    const params = new URLSearchParams();
    params.set("logs", "1");
    params.set("limit", "220");
    if (toolId) params.set("toolId", toolId);
    const response = await fetch(`/api/tools?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      tools?: ToolRecord[];
      logs?: ToolLogRow[];
      pendingConfirmations?: Array<{ id: string; toolId: string; expiresAt: string }>;
    };
    setTools(payload.tools ?? []);
    setLogs(payload.logs ?? []);
    setPendingConfirmations(payload.pendingConfirmations ?? []);
    if (!toolId && payload.tools?.length && !payload.tools.some((tool) => tool.id === selectedTool)) {
      setSelectedTool(payload.tools[0].id);
    }
  }, [selectedTool]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedTool) return;
    load(selectedTool);
  }, [selectedTool, load]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type === "tool.called") {
      const toolId = String(latest.toolId ?? "");
      setTools((current) =>
        current.map((tool) => tool.id === toolId ? { ...tool, invocations: tool.invocations + 1 } : tool)
      );
      return;
    }
    if (latest.type === "tool.completed") {
      const toolId = String(latest.toolId ?? "");
      const detail = String(latest.detail ?? "");
      const status = String(latest.status ?? "ok");
      const row: ToolLogRow = {
        id: Date.now(),
        session_key: "live",
        tool_id: toolId,
        risk: String(latest.risk ?? "unknown"),
        status,
        detail,
        created_at: String(latest.timestamp ?? new Date().toISOString())
      };
      setLogs((current) => [row, ...current].slice(0, 220));
      if (!selectedTool || selectedTool === toolId) {
        setSelectedTool(toolId);
      }
    }
  }, [events, selectedTool]);

  const selected = useMemo(() => tools.find((tool) => tool.id === selectedTool) ?? null, [tools, selectedTool]);

  async function updateConfig(toolId: string, patch: { enabled?: boolean; requireConfirmation?: boolean }) {
    const response = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "config",
        toolId,
        ...patch
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update tool config.");
    }
    await load(selectedTool || toolId);
    setStatus(`Updated config for tool '${toolId}'.`);
  }

  async function confirm(confirmationId: string) {
    const response = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        confirmationId
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.reason ?? payload.error ?? "Failed confirmation.");
      return;
    }
    setStatus(`Confirmation ${confirmationId} executed.`);
    await load(selectedTool);
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Capability Registry: Tools</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Global tool orchestration, risk boundaries, sandbox policies, and real-time execution telemetry.
          </div>
        </div>
        <div className="gc-badge" style={{ padding: "0.5rem 0.8rem" }}>
          {tools.length} TOOLS LOADED
        </div>
      </section>

      {/* Main Content: Split View */}
      <section style={{ display: "grid", gridTemplateColumns: "350px minmax(0, 1fr)", gap: "1.2rem", alignItems: "start" }}>
        {/* Tool Sidebar */}
        <div className="gc-card gc-scroll" style={{ padding: "1.2rem", position: "sticky", top: "72px", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--gc-muted)" }}>Inventory</strong>
          </div>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={selectedTool === tool.id ? "" : "gc-card-interactive"}
                style={{
                  border: "1px solid",
                  borderColor: selectedTool === tool.id ? "var(--gc-primary)" : "var(--gc-border)",
                  borderRadius: "10px",
                  padding: "0.8rem",
                  textAlign: "left",
                  background: selectedTool === tool.id ? "rgba(0, 191, 165, 0.1)" : "transparent",
                  cursor: "pointer",
                  display: "grid",
                  gap: "0.25rem",
                  transition: "all 150ms"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: selectedTool === tool.id ? "var(--gc-primary)" : "inherit" }}>
                    {tool.id}
                  </span>
                  <div className="gc-status-dot" style={{ background: tool.enabled ? "var(--gc-primary)" : "var(--gc-muted)" }}></div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.7rem", color: "var(--gc-muted)" }}>
                  <span style={{ color: tool.risk === "dangerous" ? "var(--gc-danger)" : tool.risk === "elevated" ? "var(--gc-alert)" : "var(--gc-primary)" }}>
                    risk:{tool.risk}
                  </span>
                  <span>•</span>
                  <span>calls:{tool.invocations}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tool Detail Area */}
        <div style={{ display: "grid", gap: "1.2rem" }}>
          {!selected ? (
            <div className="gc-card" style={{ padding: "4rem", textAlign: "center", color: "var(--gc-muted)" }}>
              Select a capability from the registry to audit its configuration and logs.
            </div>
          ) : (
            <>
              {/* Tool Identity & Config */}
              <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600 }}>{selected.id}</h2>
                    <div style={{ color: "var(--gc-muted)", fontSize: "0.9rem", marginTop: "0.4rem" }}>{selected.description}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      onClick={() => updateConfig(selected.id, { enabled: !selected.enabled })}
                      className="gc-button"
                      style={{ padding: "0.6rem 1rem", minWidth: "120px" }}
                    >
                      {selected.enabled ? "Deactivate" : "Activate Tool"}
                    </button>
                    <button
                      onClick={() => updateConfig(selected.id, { requireConfirmation: !selected.requireConfirmation })}
                      className="gc-button gc-button-primary"
                      style={{ padding: "0.6rem 1rem" }}
                    >
                      {selected.requireConfirmation ? "Auto-Approve" : "Enable Confirmation"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                   {[
                    { label: "Category", value: selected.id.startsWith("forge-") ? "Generated" : "System Built-in" },
                    { label: "Runtime Path", value: selected.sandboxed ? "Isolation Sandbox" : "Native Runtime" },
                    { label: "Security Risk", value: selected.risk.toUpperCase(), color: selected.risk === "dangerous" ? "var(--gc-danger)" : selected.risk === "elevated" ? "var(--gc-alert)" : "var(--gc-primary)" },
                    { label: "Execution Count", value: String(selected.invocations) }
                  ].map((item) => (
                    <div key={item.label} className="gc-card" style={{ padding: "0.8rem", background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ color: "var(--gc-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{item.label}</div>
                      <div style={{ marginTop: "0.4rem", fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 600, color: (item as any).color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Pending Approvals */}
              {pendingConfirmations.length > 0 && (
                <section className="gc-card" style={{ padding: "1.2rem", border: "1px solid var(--gc-alert-soft)" }}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--gc-alert)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--gc-alert)", display: "inline-block" }}></span>
                    Pending Security Approvals
                  </h3>
                  <div style={{ display: "grid", gap: "0.6rem" }}>
                    {pendingConfirmations.map((entry) => (
                      <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", background: "rgba(255, 171, 0, 0.05)", borderRadius: "8px", border: "1px solid var(--gc-alert-soft)" }}>
                        <div style={{ display: "grid", gap: "0.2rem" }}>
                           <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>Request: {entry.id}</span>
                           <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>Expires: {new Date(entry.expiresAt).toLocaleTimeString()}</span>
                        </div>
                        <button onClick={() => confirm(entry.id)} className="gc-button gc-button-primary" style={{ padding: "0.4rem 0.8rem", background: "var(--gc-alert)", border: "none" }}>
                          Authorize Execution
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Execution Logs */}
              <section className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gc-muted)" }}>Capability Logs</h3>
                <div className="gc-scroll" style={{ maxHeight: "400px", overflowY: "auto", display: "grid", gap: "0.8rem" }}>
                  {logs.length === 0 ? (
                    <div style={{ color: "var(--gc-muted)", fontSize: "0.9rem", textAlign: "center", padding: "2rem" }}>No telemetry data captured for this capability.</div>
                  ) : (
                    logs.map((row) => (
                      <div key={row.id} style={{ padding: "1rem", border: "1px solid var(--gc-border)", borderRadius: "10px", background: "rgba(255,255,255,0.01)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span className="gc-badge" style={{ background: row.status === "ok" ? "rgba(0, 191, 165, 0.1)" : "rgba(255, 94, 94, 0.1)", color: row.status === "ok" ? "var(--gc-primary)" : "var(--gc-danger)" }}>
                              {row.status.toUpperCase()}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--gc-muted)" }}>{row.session_key}</span>
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>{new Date(row.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: "inherit", fontSize: "0.85rem", whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: "0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "var(--font-mono)" }}>
                          {row.detail || "(Telemetry yielded no explicit detail)"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </section>

      {status ? (
        <div style={{ position: "fixed", bottom: "2rem", right: "2rem", padding: "0.8rem 1.2rem", background: "var(--gc-surface)", border: "1px solid var(--gc-primary)", borderRadius: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", zIndex: 1000, color: "var(--gc-primary)", fontSize: "0.9rem" }}>
          {status}
          <button onClick={() => setStatus("")} style={{ marginLeft: "1rem", background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer" }}>✕</button>
        </div>
      ) : null}
    </div>
  );
}
