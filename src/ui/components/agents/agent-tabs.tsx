"use client";

import Link from "next/link";

interface AgentSummary {
  id: string;
  label: string;
  status: "active" | "idle" | "busy" | "paused" | "error";
  parentId?: string;
}

interface Props {
  agents: AgentSummary[];
  selectedAgentId?: string;
  onSelect?: (agentId: string) => void;
  interactive?: boolean;
}

function statusColor(status: AgentSummary["status"]) {
  if (status === "active") return "var(--gc-primary)";
  if (status === "busy") return "var(--gc-alert)";
  if (status === "error") return "var(--gc-danger)";
  if (status === "paused") return "#9da9b8";
  return "var(--gc-muted)";
}

export function AgentTabs({ agents, selectedAgentId, onSelect, interactive = false }: Props) {
  return (
    <div className="gc-card" style={{ padding: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <strong>Agents</strong>
        <span className="gc-badge">L3</span>
      </div>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {agents.map((agent) => {
          const content = (
            <>
              <div style={{ display: "grid", gap: "0.1rem" }}>
                <span>{agent.label}</span>
                <span style={{ color: "var(--gc-muted)", fontSize: "0.7rem" }}>{agent.id}{agent.parentId ? ` <- ${agent.parentId}` : ""}</span>
              </div>
              <span
                style={{
                  fontSize: "0.73rem",
                  color: statusColor(agent.status)
                }}
              >
                {agent.status}
              </span>
            </>
          );

          if (interactive) {
            return (
              <button
                key={agent.id}
                onClick={() => onSelect?.(agent.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: `1px solid ${selectedAgentId === agent.id ? "var(--gc-primary-soft)" : "var(--gc-border)"}`,
                  borderRadius: "10px",
                  padding: "0.5rem 0.65rem",
                  background: selectedAgentId === agent.id ? "rgba(25, 209, 195, 0.08)" : "transparent",
                  textAlign: "left",
                  cursor: "pointer"
                }}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid var(--gc-border)",
                borderRadius: "10px",
                padding: "0.5rem 0.65rem",
                cursor: "pointer"
              }}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
