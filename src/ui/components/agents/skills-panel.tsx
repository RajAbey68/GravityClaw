"use client";

import { FormEvent, useEffect, useState } from "react";

interface SkillRecord {
  id: string;
  sourcePath: string;
  version: string;
  enabled: boolean;
  scopeDefault: "shared" | "isolated";
}

interface AgentRecord {
  id: string;
  label: string;
}

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("main");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [mode, setMode] = useState<"shared" | "isolated">("shared");
  const [result, setResult] = useState("idle");

  useEffect(() => {
    fetch("/api/skills?agentId=main")
      .then((response) => response.json())
      .then((data: { skills?: SkillRecord[] }) => {
        setSkills(data.skills ?? []);
        setSelectedSkillId(data.skills?.[0]?.id ?? "");
      })
      .catch(() => setSkills([]));

    fetch("/api/agents")
      .then((response) => response.json())
      .then((data: { agents?: AgentRecord[] }) => setAgents(data.agents ?? []))
      .catch(() => setAgents([]));
  }, []);

  async function attach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAgentId || !selectedSkillId) return;

    const response = await fetch("/api/skills/attach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: selectedAgentId,
        skillId: selectedSkillId,
        mode
      })
    });
    const payload = await response.json();
    setResult(JSON.stringify(payload));
  }

  return (
    <section className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.65rem" }}>
      <h2 style={{ margin: 0 }}>Skills</h2>
      <p style={{ margin: 0, color: "var(--gc-muted)" }}>
        Runtime skill registry with shared-by-default inheritance and optional isolated bindings per agent.
      </p>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {skills.map((skill) => (
          <div key={skill.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.42rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ fontSize: "0.82rem" }}>{skill.id}</strong>
              <span style={{ fontSize: "0.72rem", color: "var(--gc-muted)" }}>{skill.version}</span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>{skill.sourcePath}</div>
          </div>
        ))}
      </div>
      <form onSubmit={attach} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.45rem" }}>
        <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.42rem" }}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.id}
            </option>
          ))}
        </select>
        <select value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.42rem" }}>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.id}
            </option>
          ))}
        </select>
        <select value={mode} onChange={(event) => setMode(event.target.value as "shared" | "isolated")} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.42rem" }}>
          <option value="shared">shared</option>
          <option value="isolated">isolated</option>
        </select>
        <button type="submit" style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "8px", padding: "0.42rem 0.55rem", cursor: "pointer" }}>
          Attach
        </button>
      </form>
      <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--gc-muted)", whiteSpace: "pre-wrap" }}>{result}</pre>
    </section>
  );
}

