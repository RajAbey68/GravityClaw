"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AgentMode, RuntimeStep } from "@/src/core/types";

interface ChatRow {
  role: "user" | "assistant";
  text: string;
  steps?: RuntimeStep[];
}

interface ChatWorkspaceProps {
  agentId: string;
  mode: AgentMode;
  title?: string;
  badge?: string;
  placeholder?: string;
  chatId?: string;
  roomId?: string;
  roundLimit?: number;
  coordinatorId?: string;
}

export function ChatWorkspace({
  agentId,
  mode,
  title,
  badge,
  placeholder,
  chatId,
  roomId,
  roundLimit,
  coordinatorId
}: ChatWorkspaceProps) {
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [busy, setBusy] = useState(false);

  const resolvedTitle = title ?? `${agentId} console`;
  const resolvedBadge = badge ?? mode;
  const resolvedPlaceholder = placeholder ?? "Ask Gravity Claw...";
  const resolvedChatId = chatId ?? `${mode}:${agentId}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;

    setBusy(true);
    setRows((prev) => [...prev, { role: "user", text }]);
    setMessage("");

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: text,
          mode,
          chatId: resolvedChatId,
          roomId,
          roundLimit,
          coordinatorId
        })
      });
      const data = (await response.json()) as { finalText?: string; error?: string; steps?: RuntimeStep[] };
      setRows((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.finalText ?? data.error ?? "No response",
          steps: data.steps ?? []
        }
      ]);
    } catch {
      setRows((prev) => [...prev, { role: "assistant", text: "Request failed." }]);
    } finally {
      setBusy(false);
    }
  }

  const helper = useMemo(() => {
    if (mode === "group") {
      return "Group mode fans out one prompt across active agents.";
    }
    if (mode === "delegated") {
      return "Delegated mode routes work to a selected or auto-created sub-agent.";
    }
    return "Direct mode sends tasks to the selected agent tab.";
  }, [mode]);

  return (
    <div className="gc-card" style={{ padding: "0.9rem", display: "grid", gap: "0.7rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
        <strong>{resolvedTitle}</strong>
        <span className="gc-badge">{resolvedBadge}</span>
      </div>
      <div style={{ color: "var(--gc-muted)", fontSize: "0.78rem" }}>{helper}</div>
      <div className="gc-scroll" style={{ minHeight: "320px", maxHeight: "48vh", overflowY: "auto", display: "grid", gap: "0.55rem" }}>
        {rows.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem" }}>Start by sending a task.</div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={`${row.role}-${idx}`}
              style={{
                border: "1px solid var(--gc-border)",
                borderRadius: "10px",
                padding: "0.55rem",
                background: row.role === "assistant" ? "rgba(25, 209, 195, 0.08)" : "transparent"
              }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>{row.role}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{row.text}</div>
              {row.role === "assistant" && row.steps && row.steps.length > 0 ? (
                <div style={{ marginTop: "0.35rem", borderTop: "1px dashed var(--gc-border)", paddingTop: "0.35rem" }}>
                  <div style={{ color: "var(--gc-muted)", fontSize: "0.7rem", marginBottom: "0.2rem" }}>runtime steps</div>
                  {row.steps.slice(0, 8).map((step, stepIndex) => (
                    <div key={`${idx}-${stepIndex}`} style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem" }}>
                      {step.iteration}.{step.phase} :: {step.detail}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.55rem" }}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={resolvedPlaceholder}
          style={{
            border: "1px solid var(--gc-border)",
            background: "var(--gc-bg-soft)",
            borderRadius: "10px",
            padding: "0.6rem 0.7rem"
          }}
        />
        <button
          type="submit"
          style={{
            border: "1px solid var(--gc-primary-soft)",
            background: "rgba(25, 209, 195, 0.12)",
            borderRadius: "10px",
            padding: "0.6rem 0.9rem",
            cursor: "pointer"
          }}
          disabled={busy}
        >
          {busy ? "Running..." : "Send"}
        </button>
      </form>
    </div>
  );
}
