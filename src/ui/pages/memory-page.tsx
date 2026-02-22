"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useControlStore } from "@/src/ui/state/control-store";

interface MemoryRow {
  id: number;
  namespace: string;
  kind: string;
  content: string;
  created_at: string;
  rank?: number;
  pinned?: boolean;
  metadata?: Record<string, unknown>;
}

interface MemoryStats {
  total: number;
  pinned: number;
  shortTerm: number;
  longTerm: number;
  archival: number;
  compressed: number;
  bytes: number;
  namespaces: number;
}

export function MemoryPage() {
  const { workspaceId, events } = useControlStore();
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [query, setQuery] = useState("");
  const [namespace, setNamespace] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "short" | "long" | "archival" | "compressed">("all");
  const [status, setStatus] = useState("");
  const [exportDump, setExportDump] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("stats", "1");
    params.set("limit", "250");
    const baseNamespace = namespace.trim() || `workspace:${workspaceId}`;
    params.set("namespace", baseNamespace);
    const response = await fetch(`/api/memory?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { memories?: MemoryRow[]; stats?: MemoryStats };
    setRows(payload.memories ?? []);
    setStats(payload.stats ?? null);
  }, [query, namespace, workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type === "memory.write" || latest.type === "memory.read") {
      load();
    }
  }, [events, load]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (kindFilter === "all") return true;
      if (kindFilter === "short") return row.kind === "short-term";
      if (kindFilter === "long") return row.kind.startsWith("long-term");
      if (kindFilter === "archival") return row.kind === "archival";
      return row.kind === "compressed";
    });
  }, [rows, kindFilter]);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load();
  }

  async function pin(memoryId: number, pinned: boolean) {
    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "pin",
        memoryId,
        pinned,
        workspaceId
      })
    });
    if (!response.ok) {
      setStatus("Failed to update pin.");
      return;
    }
    await load();
  }

  async function remove(memoryId: number) {
    if (!window.confirm(`Delete memory entry #${memoryId}?`)) return;
    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        memoryId,
        workspaceId
      })
    });
    if (!response.ok) {
      setStatus("Failed to delete memory entry.");
      return;
    }
    await load();
  }

  async function exportMemory() {
    const params = new URLSearchParams();
    params.set("export", "json");
    params.set("limit", "400");
    params.set("namespace", namespace.trim() || `workspace:${workspaceId}`);
    const response = await fetch(`/api/memory?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json();
    setExportDump(JSON.stringify(payload.export ?? payload, null, 2));
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Cognitive Engine: Memory Registry</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Audit short-term working context, semantic long-term storage, and compressed archival snapshots.
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.8rem" }}>
           <button onClick={exportMemory} className="gc-button" style={{ padding: "0.6rem 1rem" }}>
              Export JSON
           </button>
           <button onClick={load} className="gc-button gc-button-primary" style={{ padding: "0.6rem 1rem" }}>
              Sync Registry
           </button>
        </div>
      </section>

      {/* Stats Dashboard */}
      {stats && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "1rem" }}>
          {[
            { label: "TOTAL ENTRIES", value: stats.total, color: "var(--gc-primary)" },
            { label: "PINNED CACHE", value: stats.pinned, color: "var(--gc-alert)" },
            { label: "SHORT-TERM", value: stats.shortTerm, color: "var(--gc-primary-soft)" },
            { label: "LONG-TERM", value: stats.longTerm, color: "var(--gc-primary)" },
            { label: "ARCHIVAL", value: stats.archival, color: "var(--gc-muted)" },
            { label: "NAMESPACES", value: stats.namespaces, color: "var(--gc-primary)" }
          ].map((metric) => (
            <div key={metric.label} className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.4rem", borderBottom: `2px solid ${metric.color}` }}>
              <div style={{ color: "var(--gc-muted)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em" }}>{metric.label}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{metric.value.toLocaleString()}</div>
            </div>
          ))}
        </section>
      )}

      {/* Search & Orientation Bar */}
      <section className="gc-card" style={{ padding: "1rem" }}>
        <form onSubmit={onSearch} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 200px auto", gap: "1rem" }}>
          <div style={{ position: "relative" }}>
             <input 
               value={query} 
               onChange={(e) => setQuery(e.target.value)} 
               placeholder="Semantic or Keyword Search..." 
               style={{ width: "100%", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem 1rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.9rem" }} 
             />
          </div>
          <input 
            value={namespace} 
            onChange={(e) => setNamespace(e.target.value)} 
            placeholder={`Filter by Namespace (Default: workspace:${workspaceId})`} 
            style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.85rem" }} 
          />
          <select 
            value={kindFilter} 
            onChange={(e) => setKindFilter(e.target.value as any)} 
            style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.85rem" }}
          >
            <option value="all">ANY TEMPORALITY</option>
            <option value="short">SHORT-TERM</option>
            <option value="long">LONG-TERM</option>
            <option value="archival">ARCHIVAL</option>
            <option value="compressed">COMPRESSED</option>
          </select>
          <button type="submit" className="gc-button gc-button-primary" style={{ padding: "0.6rem 2rem" }}>
            EXECUTE SCAN
          </button>
        </form>
      </section>

      {/* Main Memory Stream */}
      <section className="gc-card" style={{ padding: "1.5rem", overflow: "hidden" }}>
        <div className="gc-scroll" style={{ display: "grid", gap: "1.2rem", maxHeight: "60vh", overflowY: "auto", paddingRight: "1rem" }}>
          {visibleRows.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "var(--gc-muted)", fontSize: "0.9rem" }}>
              The current search filter returned zero matching cognitive fragments.
            </div>
          ) : (
            visibleRows.map((row) => (
              <div key={row.id} style={{ 
                border: "1px solid var(--gc-border)", 
                borderRadius: "12px", 
                padding: "1.2rem", 
                background: row.pinned ? "rgba(0, 191, 165, 0.03)" : "rgba(255,255,255,0.01)",
                display: "grid", 
                gap: "1rem",
                transition: "all 200ms"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--gc-muted)", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "4px" }}>
                      ID:{row.id}
                    </span>
                    <span className="gc-badge" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>{row.namespace}</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gc-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.kind}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </div>
                
                <div style={{ borderLeft: "2px solid var(--gc-primary-soft)", paddingLeft: "1.2rem", color: "rgba(255,255,255,0.9)", fontSize: "0.95rem", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {row.content}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                     {row.rank !== undefined && (
                        <div className="gc-badge" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)" }}>
                           REL_RANK: {row.rank.toFixed(4)}
                        </div>
                     )}
                     {row.metadata && Object.keys(row.metadata).length > 0 && (
                        <div className="gc-badge" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.03)", cursor: "help" }} title={JSON.stringify(row.metadata, null, 2)}>
                           HAS_METADATA ({Object.keys(row.metadata).length})
                        </div>
                     )}
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button 
                      onClick={() => pin(row.id, !row.pinned)} 
                      className={`gc-button ${row.pinned ? "gc-button-primary" : ""}`}
                      style={{ padding: "0.4rem 1rem", fontSize: "0.75rem" }}
                    >
                      {row.pinned ? "UNPIN FRAGMENT" : "PIN TO CACHE"}
                    </button>
                    <button 
                      onClick={() => remove(row.id)} 
                      className="gc-button"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.75rem", color: "var(--gc-danger)" }}
                    >
                      PURGE
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Export Debug Overlay */}
      {exportDump && (
        <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Raw Memory Export (Decrypted)</h2>
             <button onClick={() => setExportDump("")} className="gc-button" style={{ padding: "0.4rem 1rem" }}>CLOSE EXPORT</button>
          </div>
          <textarea 
            readOnly 
            value={exportDump} 
            style={{ minHeight: "300px", width: "100%", border: "1px solid var(--gc-border)", borderRadius: "10px", padding: "1rem", background: "rgba(0,0,0,0.2)", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--gc-primary)", outline: "none" }} 
          />
        </section>
      )}

      {status ? (
        <div style={{ position: "fixed", bottom: "2rem", right: "2rem", padding: "0.8rem 1.2rem", background: "var(--gc-surface)", border: "1px solid var(--gc-primary)", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", zIndex: 1000, color: "var(--gc-primary)", fontSize: "0.9rem" }}>
          {status}
          <button onClick={() => setStatus("")} style={{ marginLeft: "1rem", background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer" }}>✕</button>
        </div>
      ) : null}
    </div>
  );
}
