"use client";

import { FormEvent, useEffect, useState } from "react";
import { useCallback } from "react";

interface MemoryRow {
  id: number;
  namespace: string;
  kind: string;
  content: string;
  created_at: string;
  rank?: number;
}

export function MemoryInspector() {
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [namespace, setNamespace] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (namespace.trim()) params.set("namespace", namespace.trim());
    params.set("limit", "120");

    const response = await fetch(`/api/memory?${params.toString()}`);
    const data = (await response.json()) as { memories: MemoryRow[] };
    setRows(data.memories ?? []);
  }, [namespace, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load();
  }

  return (
    <div className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.7rem" }}>
      <h2 style={{ marginTop: 0 }}>Memory Inspector</h2>
      <form onSubmit={onSearch} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.45rem" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="FTS search query"
          style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.45rem" }}
        />
        <input
          value={namespace}
          onChange={(event) => setNamespace(event.target.value)}
          placeholder="namespace (optional)"
          style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.45rem" }}
        />
        <button
          type="submit"
          style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "9px", padding: "0.45rem 0.65rem", cursor: "pointer" }}
        >
          Search
        </button>
      </form>
      <div className="gc-scroll" style={{ display: "grid", gap: "0.45rem", maxHeight: "58vh", overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div style={{ color: "var(--gc-muted)" }}>No memory entries found.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "10px", padding: "0.55rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem" }}>
                <span>{row.namespace}</span>
                <span style={{ color: "var(--gc-muted)" }}>{row.kind}</span>
              </div>
              {typeof row.rank === "number" ? (
                <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)", marginTop: "0.2rem" }}>rank: {row.rank.toFixed(4)}</div>
              ) : null}
              <div style={{ marginTop: "0.3rem", whiteSpace: "pre-wrap" }}>{row.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
