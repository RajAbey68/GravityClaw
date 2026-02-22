"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentDescriptor } from "@/src/core/types";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore } from "@/src/ui/state/control-store";

interface SkillRecord {
  id: string;
  sourcePath: string;
  codePath: string;
  version: string;
  enabled: boolean;
  scopeDefault: "shared" | "isolated";
  description: string;
  dependencies: string[];
  assignedAgents: string[];
}

interface SkillBinding {
  id: number;
  agent_id: string;
  skill_id: string;
  mode: "shared" | "isolated";
}

export function SkillsPage() {
  const { workspaceId } = useControlStore();
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [bindings, setBindings] = useState<SkillBinding[]>([]);
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("main");
  const [assignMode, setAssignMode] = useState<"shared" | "isolated">("shared");
  const [codeView, setCodeView] = useState("");
  const [logsView, setLogsView] = useState("");
  const [editor, setEditor] = useState({ version: "", prompt: "", scopeDefault: "shared" as "shared" | "isolated" });
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [skillResponse, agentResponse] = await Promise.all([
      fetch(`/api/skills?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" }),
      fetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" })
    ]);

    const skillPayload = (await skillResponse.json()) as { skills?: SkillRecord[]; bindings?: SkillBinding[] };
    const agentPayload = (await agentResponse.json()) as { agents?: AgentDescriptor[] };
    const skillList = skillPayload.skills ?? [];
    setSkills(skillList);
    setBindings(skillPayload.bindings ?? []);
    setAgents(agentPayload.agents ?? []);
    if (skillList.length > 0 && !skillList.some((skill) => skill.id === selectedSkillId)) {
      setSelectedSkillId(skillList[0].id);
    }
    if (agentPayload.agents?.length) {
      setSelectedAgentId((current) =>
        agentPayload.agents?.some((agent) => agent.id === current) ? current : agentPayload.agents?.[0]?.id ?? "main"
      );
    }
  }, [workspaceId, selectedSkillId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [skills, selectedSkillId]
  );

  useEffect(() => {
    if (!selectedSkill) return;
    setEditor({
      version: selectedSkill.version,
      prompt: "",
      scopeDefault: selectedSkill.scopeDefault
    });
  }, [selectedSkill]);

  async function toggleSkillEnabled(skill: SkillRecord) {
    const response = await fetch("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "update",
        skillId: skill.id,
        enabled: !skill.enabled
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update skill.");
    }
    await load();
  }

  async function assignSkill() {
    if (!selectedSkillId || !selectedAgentId) return;
    const response = await fetch("/api/skills/attach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        agentId: selectedAgentId,
        skillId: selectedSkillId,
        mode: assignMode
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to assign skill.");
    }
    await load();
    setStatus(`Assigned ${selectedSkillId} to ${selectedAgentId} (${assignMode}).`);
  }

  async function removeBinding(skillId: string, agentScopedId: string) {
    const [scopedWorkspace, ...agentParts] = agentScopedId.split(":");
    const agentId = agentParts.length > 0 ? agentParts.join(":") : agentScopedId;
    const response = await fetch("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "detach",
        workspaceId: scopedWorkspace || workspaceId,
        agentId,
        skillId
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Failed to remove skill binding.");
      return;
    }
    await load();
  }

  async function viewSkillCode(skillId: string) {
    const response = await fetch(`/api/skills?workspaceId=${encodeURIComponent(workspaceId)}&includeCode=1&skillId=${encodeURIComponent(skillId)}`, {
      cache: "no-store"
    });
    const payload = await response.json();
    if (!response.ok) {
      setCodeView(payload.error ?? "Unable to load skill code.");
      return;
    }
    setCodeView(`Path: ${payload.code.path}\n\n${payload.code.content}`);
  }

  async function viewSkillLogs(skillId: string) {
    const response = await fetch(`/api/logs?tab=audit&limit=180`, { cache: "no-store" });
    const payload = (await response.json()) as { logs?: Array<{ payload: { target_path?: string; summary?: string; created_at?: string } }> };
    const filtered = (payload.logs ?? []).filter((entry) => JSON.stringify(entry).toLowerCase().includes(skillId.toLowerCase()));
    setLogsView(
      filtered.length === 0
        ? "No skill-specific audit logs."
        : filtered
            .slice(0, 80)
            .map((entry) => JSON.stringify(entry.payload))
            .join("\n")
    );
  }

  async function saveSkillMetadata() {
    if (!selectedSkill) return;
    const response = await fetch("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "update",
        skillId: selectedSkill.id,
        version: editor.version,
        prompt: editor.prompt.trim() || undefined,
        scopeDefault: editor.scopeDefault
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update skill.");
    }
    await load();
    setStatus(`Updated metadata for ${selectedSkill.id}.`);
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Capability Registry: Skills</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Manage autonomous behaviors, versioned cognitive modules, and multi-agent skill bindings.
          </div>
        </div>
        <div className="gc-badge" style={{ padding: "0.5rem 0.8rem" }}>
          {skills.length} SKILLS REGISTERED
        </div>
      </section>

      {/* Main Content: Split View */}
      <section style={{ display: "grid", gridTemplateColumns: "350px minmax(0, 1fr)", gap: "1.2rem", alignItems: "start" }}>
        {/* Skill Sidebar */}
        <div className="gc-card gc-scroll" style={{ padding: "1.2rem", position: "sticky", top: "72px", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--gc-muted)" }}>Skill Set</strong>
          </div>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => setSelectedSkillId(skill.id)}
                className={selectedSkillId === skill.id ? "" : "gc-card-interactive"}
                style={{
                  border: "1px solid",
                  borderColor: selectedSkillId === skill.id ? "var(--gc-primary)" : "var(--gc-border)",
                  borderRadius: "10px",
                  padding: "0.8rem",
                  textAlign: "left",
                  background: selectedSkillId === skill.id ? "rgba(0, 191, 165, 0.1)" : "transparent",
                  cursor: "pointer",
                  display: "grid",
                  gap: "0.25rem",
                  transition: "all 150ms"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: selectedSkillId === skill.id ? "var(--gc-primary)" : "inherit" }}>
                    {skill.id}
                  </span>
                  <div className="gc-status-dot" style={{ background: skill.enabled ? "var(--gc-primary)" : "var(--gc-muted)" }}></div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.71rem", color: "var(--gc-muted)" }}>
                  <span>v{skill.version}</span>
                  <span>•</span>
                  <span>Bound: {skill.assignedAgents.length}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Skill Detail Area */}
        <div style={{ display: "grid", gap: "1.2rem" }}>
          {!selectedSkill ? (
             <div className="gc-card" style={{ padding: "4rem", textAlign: "center", color: "var(--gc-muted)" }}>
                Select a cognitive skill from the registry to configure its behavior and agent bindings.
             </div>
          ) : (
            <>
              {/* Skill Core Metadata */}
              <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600 }}>{selectedSkill.id}</h2>
                    <div style={{ color: "var(--gc-muted)", fontSize: "0.95rem", marginTop: "0.4rem" }}>{selectedSkill.description || "No documentation found for this skill."}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                     <button
                      onClick={() => toggleSkillEnabled(selectedSkill)}
                      className="gc-button"
                      style={{ padding: "0.6rem 1.2rem" }}
                    >
                      {selectedSkill.enabled ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={saveSkillMetadata}
                      className="gc-button gc-button-primary"
                      style={{ padding: "0.6rem 1.2rem" }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div style={{ display: "grid", gap: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                       <label style={{ display: "grid", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Module Version</span>
                        <input value={editor.version} onChange={(e) => setEditor(c => ({...c, version: e.target.value}))} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)" }} />
                      </label>
                      <label style={{ display: "grid", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Default Execution Scope</span>
                        <select value={editor.scopeDefault} onChange={(e) => setEditor(c => ({...c, scopeDefault: e.target.value as any}))} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)" }}>
                          <option value="shared">Shared Utility</option>
                          <option value="isolated">Isolated Instance</option>
                        </select>
                      </label>
                    </div>
                    <label style={{ display: "grid", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Cognitive Bias / Prompt Override</span>
                      <textarea 
                        value={editor.prompt} 
                        onChange={(e) => setEditor(c => ({...c, prompt: e.target.value}))} 
                        placeholder="Force specific behavioral patterns when this skill is invoked..." 
                        style={{ minHeight: "120px", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.8rem", background: "var(--gc-surface)", resize: "vertical" }} 
                      />
                    </label>
                  </div>

                  <div className="gc-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.01)" }}>
                     <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--gc-muted)", textTransform: "uppercase" }}>Agent Assignments</h3>
                     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.6rem", marginBottom: "1rem" }}>
                        <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.5rem", background: "var(--gc-surface)", fontSize: "0.8rem" }}>
                          {agents.map(a => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
                        </select>
                        <select value={assignMode} onChange={(e) => setAssignMode(e.target.value as any)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.5rem", background: "var(--gc-surface)", fontSize: "0.8rem" }}>
                          <option value="shared">Shared</option>
                          <option value="isolated">Isolated</option>
                        </select>
                        <button onClick={assignSkill} className="gc-button gc-button-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Bind</button>
                     </div>
                     <div className="gc-scroll" style={{ maxHeight: "140px", overflowY: "auto", display: "grid", gap: "0.4rem" }}>
                        {bindings.filter(b => b.skill_id === selectedSkill.id).map(b => (
                          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", background: "var(--gc-bg-soft)", borderRadius: "8px", border: "1px solid var(--gc-border)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{b.agent_id}</span>
                              <span className="gc-badge" style={{ fontSize: "0.65rem" }}>{b.mode}</span>
                            </div>
                            <button onClick={() => removeBinding(selectedSkill.id, b.agent_id)} style={{ padding: "0.2rem 0.4rem", background: "none", border: "none", color: "var(--gc-danger)", cursor: "pointer", fontSize: "0.75rem" }}>Remove</button>
                          </div>
                        ))}
                        {bindings.filter(b => b.skill_id === selectedSkill.id).length === 0 && (
                          <div style={{ textAlign: "center", padding: "1rem", color: "var(--gc-muted)", fontSize: "0.8rem" }}>No agents bound to this skill.</div>
                        )}
                     </div>
                  </div>
                </div>
              </section>

              {/* Advanced Inspection (Code & Logs) */}
              <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
                 <div style={{ display: "flex", gap: "1rem" }}>
                    <button 
                      onClick={() => viewSkillCode(selectedSkill.id)}
                      className="gc-button" 
                      style={{ padding: "0.6rem 1.2rem", flex: 1, border: codeView ? "1px solid var(--gc-primary)" : "1px solid var(--gc-border)" }}
                    >
                      Inspect Source Logic
                    </button>
                    <button 
                      onClick={() => viewSkillLogs(selectedSkill.id)}
                      className="gc-button" 
                      style={{ padding: "0.6rem 1.2rem", flex: 1, border: logsView ? "1px solid var(--gc-primary)" : "1px solid var(--gc-border)" }}
                    >
                      Audit Execution Logs
                    </button>
                 </div>
                 
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                       <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)", textTransform: "uppercase" }}>Source Code Terminal</div>
                       <textarea 
                          readOnly 
                          value={codeView} 
                          placeholder="Execute 'Inspect' to view skill logic..." 
                          style={{ minHeight: "350px", border: "1px solid var(--gc-border)", borderRadius: "10px", padding: "1.2rem", background: "rgba(0,0,0,0.3)", color: "#a2acba", fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: "1.6", resize: "none" }} 
                       />
                    </div>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                       <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)", textTransform: "uppercase" }}>Runtime Audit Stream</div>
                       <textarea 
                          readOnly 
                          value={logsView} 
                          placeholder="Execute 'Audit' to view event stream..." 
                          style={{ minHeight: "350px", border: "1px solid var(--gc-border)", borderRadius: "10px", padding: "1.2rem", background: "rgba(0,0,0,0.3)", color: "var(--gc-primary-soft)", fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: "1.6", resize: "none" }} 
                       />
                    </div>
                 </div>
              </section>
            </>
          )}
        </div>
      </section>

      {status ? (
         <div style={{ position: "fixed", bottom: "2rem", right: "2rem", padding: "0.8rem 1.2rem", background: "var(--gc-surface)", border: "1px solid var(--gc-primary)", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", zIndex: 1000, color: "var(--gc-primary)", fontSize: "0.9rem" }}>
          {status}
          <button onClick={() => setStatus("")} style={{ marginLeft: "1rem", background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer" }}>✕</button>
        </div>
      ) : null}
    </div>
  );
}

