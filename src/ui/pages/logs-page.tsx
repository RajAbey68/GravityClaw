"use client";

import { useCallback, useEffect, useState } from "react";
import { useControlStore } from "@/src/ui/state/control-store";

type LogTab = "all" | "system" | "agent" | "tool" | "forge" | "delegation" | "audit";
type Severity = "all" | "info" | "warning" | "error";

interface LogEntry {
  tab: LogTab;
  type: string;
  timestamp: string;
  severity: Severity;
  agent?: string;
  payload: Record<string, unknown>;
}

export function LogsPage() {
  const { events } = useControlStore();
  const [tab, setTab] = useState<LogTab>("all");
  const [severity, setSeverity] = useState<Severity>("all");
  const [agent, setAgent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (severity !== "all") params.set("severity", severity);
    if (agent.trim()) params.set("agent", agent.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", "350");
    const response = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { logs?: LogEntry[] };
    setLogs(payload.logs ?? []);
  }, [tab, severity, agent, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    load();
  }, [events, load]);

  const severityColors = {
    info: "var(--gc-primary)",
    warning: "#ffab00",
    error: "var(--gc-danger)",
    all: "var(--gc-muted)"
  };

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>System Telemetry & Logs</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Real-time audit of system events, agent reasoning, and tool executions across the platform.
          </div>
        </div>
        <button onClick={load} className="gc-button gc-button-primary" style={{ padding: "0.6rem 1.2rem" }}>
           Sync Logs
        </button>
      </section>

      {/* Filter Matrix Card */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>LOG DOMAIN</span>
            <select 
              value={tab} 
              onChange={(e) => setTab(e.target.value as LogTab)} 
              style={{ width: "100%", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", fontSize: "0.85rem", outline: "none" }}
            >
              <option value="all">ALL DOMAINS</option>
              <option value="system">SYSTEM OPERATIONS</option>
              <option value="agent">AGENT REASONING</option>
              <option value="tool">TOOL EXECUTIONS</option>
              <option value="forge">FORGE EVENTS</option>
              <option value="delegation">DELEGATION CHAIN</option>
              <option value="audit">SECURITY AUDIT</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>SEVERITY LEVEL</span>
            <select 
              value={severity} 
              onChange={(e) => setSeverity(e.target.value as Severity)} 
              style={{ width: "100%", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", fontSize: "0.85rem", outline: "none" }}
            >
              <option value="all">ANY SEVERITY</option>
              <option value="info">INFO (Normal)</option>
              <option value="warning">WARNING (Caution)</option>
              <option value="error">ERROR (Critical)</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>AGENT FILTER</span>
            <input 
              value={agent} 
              onChange={(e) => setAgent(e.target.value)} 
              placeholder="e.g. main" 
              style={{ width: "100%", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", fontSize: "0.85rem", outline: "none" }} 
            />
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>FROM WINDOW</span>
            <input 
              type="datetime-local" 
              value={from} 
              onChange={(e) => setFrom(e.target.value)} 
              style={{ width: "100%", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", fontSize: "0.85rem", outline: "none" }} 
            />
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>TO WINDOW</span>
            <input 
              type="datetime-local" 
              value={to} 
              onChange={(e) => setTo(e.target.value)} 
              style={{ width: "100%", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", fontSize: "0.85rem", outline: "none" }} 
            />
          </div>
        </div>
      </section>

      {/* Main Terminal Output */}
      <section className="gc-card" style={{ padding: "0", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", overflow: "hidden" }}>
        <div className="gc-scroll" style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto", display: "grid", gap: "1px", background: "var(--gc-border)" }}>
          {logs.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "var(--gc-muted)", fontSize: "0.9rem", background: "var(--gc-bg)" }}>
              Zero telemetry matches for the selected filter parameters.
            </div>
          ) : (
            logs.map((entry, index) => (
              <details key={`${entry.timestamp}-${index}`} className="gc-log-entry" style={{ background: "var(--gc-bg)", outline: "none" }}>
                <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", padding: "0.8rem 1.2rem", hover: { background: "rgba(255,255,255,0.02)" } } as any}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: severityColors[entry.severity] || "var(--gc-muted)", boxShadow: `0 0 10px ${severityColors[entry.severity]}44` }}></div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--gc-muted)", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "4px", width: "80px", textAlign: "center" }}>
                      {entry.tab.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>{entry.type}</span>
                    {entry.agent && (
                       <span className="gc-badge" style={{ fontSize: "0.65rem", padding: "1px 6px", background: "rgba(0, 191, 165, 0.1)", color: "var(--gc-primary)" }}>
                          AGENT:{entry.agent}
                       </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: entry.severity === "error" ? "var(--gc-danger)" : "var(--gc-muted)" }}>
                      {entry.severity.toUpperCase()}
                    </span>
                    <span style={{ color: "var(--gc-muted)", fontSize: "0.75rem", width: "160px", textAlign: "right" }}>
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 })}
                    </span>
                  </div>
                </summary>
                <div style={{ padding: "0 1.2rem 1.2rem 3rem" }}>
                  <pre style={{ margin: "0", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "1rem", border: "1px solid var(--gc-border)", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "rgba(25, 209, 195, 0.8)", overflow: "auto" }}>
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                </div>
              </details>
            ))
          )}
        </div>
      </section>

      <style jsx>{`
        .gc-log-entry summary::-webkit-details-marker { display: none; }
        .gc-log-entry summary { list-style: none; outline: none; transition: background 150ms; }
        .gc-log-entry summary:hover { background: rgba(255,255,255,0.02); }
        .gc-log-entry[open] { background: rgba(255,255,255,0.01) !important; }
      `}</style>
    </div>
  );
}

