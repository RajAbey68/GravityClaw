"use client";

import { FormEvent, useEffect, useState } from "react";

interface ToolItem {
  id: string;
  description: string;
  risk: "safe" | "elevated" | "dangerous";
}

interface PendingConfirmation {
  id: string;
  toolId: string;
  reason: string;
  risk: "elevated" | "dangerous";
  expiresAt: string;
}

interface ToolState {
  tools: ToolItem[];
  pendingConfirmations: PendingConfirmation[];
}

async function loadTools() {
  return (await (await fetch("/api/tools")).json()) as ToolState;
}

export function ToolSafetyPanel() {
  const [state, setState] = useState<ToolState>({ tools: [], pendingConfirmations: [] });
  const [relativePath, setRelativePath] = useState("notes/session.txt");
  const [content, setContent] = useState("Tool layer smoke test");
  const [result, setResult] = useState("idle");

  useEffect(() => {
    loadTools().then(setState);
  }, []);

  async function refresh() {
    setState(await loadTools());
  }

  async function executeDangerous(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolId: "file-write",
        input: { relativePath, content },
        agentId: "main"
      })
    });

    const data = await response.json();
    setResult(JSON.stringify(data));
    await refresh();
  }

  async function confirm(id: string) {
    const response = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationId: id })
    });
    const data = await response.json();
    setResult(JSON.stringify(data));
    await refresh();
  }

  return (
    <section className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.7rem" }}>
      <h2 style={{ margin: 0 }}>Tool Layer</h2>
      <p style={{ color: "var(--gc-muted)", margin: 0 }}>
        Global registry, policy checks, sandboxed execution, and explicit confirmation for dangerous tools.
      </p>

      <div style={{ display: "grid", gap: "0.45rem" }}>
        {state.tools.map((tool) => (
          <div key={tool.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.45rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{tool.id}</strong>
              <span style={{ color: tool.risk === "dangerous" ? "var(--gc-alert)" : "var(--gc-muted)", fontSize: "0.75rem" }}>
                {tool.risk}
              </span>
            </div>
            <div style={{ color: "var(--gc-muted)", fontSize: "0.75rem" }}>{tool.description}</div>
          </div>
        ))}
      </div>

      <form onSubmit={executeDangerous} style={{ display: "grid", gap: "0.45rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>Dangerous Tool Probe (`file-write`)</strong>
        <input value={relativePath} onChange={(e) => setRelativePath(e.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem" }} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", minHeight: "80px" }} />
        <button type="submit" style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "8px", padding: "0.45rem", cursor: "pointer" }}>
          Execute (will require confirmation)
        </button>
      </form>

      <div className="gc-card" style={{ padding: "0.55rem", display: "grid", gap: "0.4rem" }}>
        <strong style={{ fontSize: "0.85rem" }}>Pending Confirmations</strong>
        {state.pendingConfirmations.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.78rem" }}>No pending confirmations.</div>
        ) : (
          state.pendingConfirmations.map((entry) => (
            <div key={entry.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.45rem", display: "grid", gap: "0.25rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{entry.id}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>
                {entry.toolId} | {entry.risk} | expires {entry.expiresAt}
              </div>
              <button onClick={() => confirm(entry.id)} style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "8px", padding: "0.35rem", cursor: "pointer" }}>
                Confirm and Run
              </button>
            </div>
          ))
        )}
      </div>

      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--gc-muted)" }}>{result}</pre>
    </section>
  );
}
