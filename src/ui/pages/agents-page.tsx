"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore } from "@/src/ui/state/control-store";
import type { AgentDescriptor } from "@/src/core/types";
import type { ProviderId } from "@/src/core/providers/types";
import { HiveCreationWizard } from "@/src/ui/components/hive/HiveCreationWizard";

interface ToolItem {
  id: string;
  description: string;
  risk: "safe" | "elevated" | "dangerous";
  enabled: boolean;
}

interface SkillItem {
  id: string;
  description: string;
  enabled: boolean;
}

interface LiveEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

interface AgentFormState {
  label: string;
  systemPromptOverride: string;
  soulOverride: string;
  provider: "" | ProviderId;
  model: string;
  temperature: string;
  maxTokens: string;
  autonomousSpawning: boolean;
  isolateShortTermMemory: boolean;
  isolateLongTermMemory: boolean;
  isolateTools: boolean;
  enabledTools: string[];
  enabledSkills: string[];
  voiceId: string;
  voiceStability: string;
  voiceSimilarityBoost: string;
}

const emptyForm: AgentFormState = {
  label: "",
  systemPromptOverride: "",
  soulOverride: "",
  provider: "",
  model: "",
  temperature: "0.2",
  maxTokens: "650",
  autonomousSpawning: true,
  isolateShortTermMemory: false,
  isolateLongTermMemory: false,
  isolateTools: false,
  enabledTools: [],
  enabledSkills: [],
  voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
  voiceStability: "0.5",
  voiceSimilarityBoost: "0.75"
};

const providerOptions: ProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
  "deepseek",
  "groq",
  "openrouter",
  "ollama"
];

function statusColor(status: AgentDescriptor["status"]) {
  if (status === "active") return "var(--gc-primary)";
  if (status === "busy") return "var(--gc-alert)";
  if (status === "error") return "var(--gc-danger)";
  if (status === "paused") return "#a2acba";
  return "var(--gc-muted)";
}

function toForm(agent: AgentDescriptor): AgentFormState {
  return {
    label: agent.label,
    systemPromptOverride: agent.systemPromptOverride ?? "",
    soulOverride: agent.soulOverride ?? "",
    provider: agent.provider ?? "",
    model: agent.model ?? "",
    temperature: String(agent.temperature ?? 0.2),
    maxTokens: String(agent.maxTokens ?? 650),
    autonomousSpawning: agent.autonomousSpawning,
    isolateShortTermMemory: agent.isolateShortTermMemory,
    isolateLongTermMemory: agent.isolateLongTermMemory,
    isolateTools: agent.isolateTools,
    enabledTools: agent.enabledTools ?? [],
    enabledSkills: agent.enabledSkills ?? [],
    voiceId: agent.voiceId ?? "21m00Tcm4TlvDq8ikWAM",
    voiceStability: String(agent.voiceStability ?? 0.5),
    voiceSimilarityBoost: String(agent.voiceSimilarityBoost ?? 0.75)
  };
}

export function AgentsPage() {
  const searchParams = useSearchParams();
  const { workspaceId, selectedAgentId, setSelectedAgentId, setChatMode, setWorkspaceId, events } = useControlStore();
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentDescriptor | null>(null);
  const [form, setForm] = useState<AgentFormState>(emptyForm);
  const [statusText, setStatusText] = useState("");
  const [liveStepByAgent, setLiveStepByAgent] = useState<Record<string, string>>({});
  const [liveIterationByAgent, setLiveIterationByAgent] = useState<Record<string, number>>({});
  const [showCreator, setShowCreator] = useState(false);
  const [showHiveWizard, setShowHiveWizard] = useState(false);
  const [creator, setCreator] = useState({
    label: "",
    id: "",
    parentId: "main",
    systemPrompt: "",
    provider: "",
    model: "",
    isolateShortTermMemory: true,
    isolateLongTermMemory: false,
    isolateTools: false,
    autonomousSpawning: true,
    enabledTools: [] as string[],
    enabledSkills: [] as string[]
  });

  const loadAgents = useCallback(async () => {
    const response = await fetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { agents?: AgentDescriptor[] };
    const list = payload.agents ?? [];
    setAgents(list);
    if (list.length > 0 && !list.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(list[0].id);
    }
  }, [workspaceId, selectedAgentId, setSelectedAgentId]);

  const loadTools = useCallback(async () => {
    const response = await fetch("/api/tools", { cache: "no-store" });
    const payload = (await response.json()) as { tools?: ToolItem[] };
    setTools(payload.tools ?? []);
  }, []);

  const loadSkills = useCallback(async () => {
    const response = await fetch(`/api/skills?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { skills?: SkillItem[] };
    setSkills(payload.skills ?? []);
  }, [workspaceId]);

  const loadAgentDetail = useCallback(async (agentId: string) => {
    const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      agent?: AgentDescriptor;
      runtime?: { currentStep?: string; iteration?: number };
    };
    if (payload.agent) {
      setActiveAgent(payload.agent);
      setForm(toForm(payload.agent));
      if (payload.runtime?.currentStep) {
        setLiveStepByAgent((current) => ({
          ...current,
          [payload.agent!.id]: payload.runtime?.currentStep ?? "idle"
        }));
      }
      if (payload.runtime?.iteration !== undefined) {
        setLiveIterationByAgent((current) => ({
          ...current,
          [payload.agent!.id]: payload.runtime?.iteration ?? 0
        }));
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    const queryAgentId = searchParams.get("agentId");
    if (queryAgentId && queryAgentId !== selectedAgentId) {
      setSelectedAgentId(queryAgentId);
    }
  }, [searchParams, selectedAgentId, setSelectedAgentId]);

  useEffect(() => {
    loadAgents();
    loadTools();
    loadSkills();
  }, [loadAgents, loadTools, loadSkills]);

  useEffect(() => {
    if (!selectedAgentId) return;
    loadAgentDetail(selectedAgentId);
  }, [selectedAgentId, loadAgentDetail]);

  useEffect(() => {
    const latest = events[0] as LiveEvent | undefined;
    if (!latest) return;
    if (latest.type === "agent.spawned") {
      loadAgents();
      return;
    }
    if (latest.type === "agent.status.changed") {
      const agentId = String(latest.agentId ?? "");
      const status = String(latest.status ?? "idle") as AgentDescriptor["status"];
      if (!agentId) return;
      setAgents((current) =>
        current.map((agent) =>
          agent.id === agentId ? { ...agent, status, updatedAt: String(latest.timestamp ?? agent.updatedAt) } : agent
        )
      );
      if (activeAgent?.id === agentId) {
        setActiveAgent((current) => (current ? { ...current, status } : current));
      }
      return;
    }
    if (latest.type === "agent.step.started" || latest.type === "agent.step.completed") {
      const agentId = String(latest.agentId ?? "");
      if (!agentId) return;
      setLiveStepByAgent((current) => ({
        ...current,
        [agentId]: String(latest.step ?? "")
      }));
      setLiveIterationByAgent((current) => ({
        ...current,
        [agentId]: Number(latest.iteration ?? current[agentId] ?? 0)
      }));
    }
  }, [events, loadAgents, activeAgent?.id]);

  const children = useMemo(
    () => agents.filter((agent) => agent.parentId === (activeAgent?.id ?? "main")),
    [agents, activeAgent]
  );

  async function saveAgent() {
    if (!activeAgent) return;
    const temperature = Number(form.temperature);
    const maxTokens = Number(form.maxTokens);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      setStatusText("Temperature must be between 0 and 2.");
      return;
    }
    if (!Number.isFinite(maxTokens) || maxTokens < 64 || maxTokens > 32000) {
      setStatusText("Max tokens must be between 64 and 32000.");
      return;
    }

    const response = await fetch(`/api/agents/${encodeURIComponent(activeAgent.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        label: form.label,
        systemPromptOverride: form.systemPromptOverride,
        soulOverride: form.soulOverride,
        provider: form.provider || undefined,
        model: form.model || undefined,
        temperature,
        maxTokens,
        autonomousSpawning: form.autonomousSpawning,
        isolateShortTermMemory: form.isolateShortTermMemory,
        isolateLongTermMemory: form.isolateLongTermMemory,
        isolateTools: form.isolateTools,
        enabledTools: form.enabledTools,
        enabledSkills: form.enabledSkills,
        voiceId: form.voiceId,
        voiceStability: Number(form.voiceStability),
        voiceSimilarityBoost: Number(form.voiceSimilarityBoost)
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update agent.");
    }

    for (const skill of form.enabledSkills) {
      await fetch("/api/skills/attach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          agentId: activeAgent.id,
          skillId: skill,
          mode: "shared"
        })
      });
    }

    const boundSkillsResponse = await fetch(`/api/skills?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const boundSkillsPayload = (await boundSkillsResponse.json()) as { bindings?: Array<{ agent_id: string; skill_id: string }> };
    const scopedAgent = `${workspaceId}:${activeAgent.id}`;
    const currentlyBound = (boundSkillsPayload.bindings ?? [])
      .filter((binding) => binding.agent_id === scopedAgent)
      .map((binding) => binding.skill_id);
    for (const skill of currentlyBound) {
      if (form.enabledSkills.includes(skill)) continue;
      await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "detach",
          workspaceId,
          agentId: activeAgent.id,
          skillId: skill
        })
      });
    }

    await loadAgents();
    await loadAgentDetail(activeAgent.id);
    setStatusText(`Saved ${activeAgent.id} in workspace '${workspaceId}'.`);
  }

  async function createSubAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creator.label.trim()) {
      setStatusText("Sub-agent name is required.");
      return;
    }
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        id: creator.id.trim() || undefined,
        label: creator.label.trim(),
        parentId: creator.parentId || "main",
        isolateShortTermMemory: creator.isolateShortTermMemory,
        isolateLongTermMemory: creator.isolateLongTermMemory,
        isolateTools: creator.isolateTools,
        autonomousSpawning: creator.autonomousSpawning
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatusText(payload.error ?? "Failed to create agent.");
      return;
    }

    const created = (payload.agents as AgentDescriptor[]).find((agent) => agent.label === creator.label.trim());
    if (created) {
      await fetch(`/api/agents/${encodeURIComponent(created.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          systemPromptOverride: creator.systemPrompt || undefined,
          provider: creator.provider || undefined,
          model: creator.model || undefined,
          enabledTools: creator.enabledTools,
          enabledSkills: creator.enabledSkills
        })
      });
      for (const skill of creator.enabledSkills) {
        await fetch("/api/skills/attach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId, agentId: created.id, skillId: skill, mode: "shared" })
        });
      }
      setSelectedAgentId(created.id);
    }

    await loadAgents();
    setShowCreator(false);
    setCreator({
      label: "",
      id: "",
      parentId: "main",
      systemPrompt: "",
      provider: "",
      model: "",
      isolateShortTermMemory: true,
      isolateLongTermMemory: false,
      isolateTools: false,
      autonomousSpawning: true,
      enabledTools: [],
      enabledSkills: []
    });
    setStatusText("Sub-agent created.");
  }

  async function setStatus(agentId: string, status: "active" | "idle" | "paused") {
    const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, status })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatusText(payload.error ?? "Failed to update status.");
      return;
    }
    await loadAgents();
    setStatusText(`Set ${agentId} status to ${status}.`);
  }

  async function deleteAgent(agentId: string) {
    if (agentId === "main") {
      setStatusText("Main agent cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete agent '${agentId}'?`)) return;
    const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatusText(payload.error ?? "Failed to delete agent.");
      return;
    }
    await loadAgents();
    if (selectedAgentId === agentId) {
      setSelectedAgentId("main");
    }
    setStatusText(`Deleted agent '${agentId}'.`);
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Agent Mesh Management</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Configure model routing, tool/skill assignments, SOUL overrides, and autonomous spawn policies.
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button 
            onClick={() => setShowHiveWizard(true)} 
            className="gc-button"
            style={{ padding: "0.6rem 1rem", border: "1px solid #a855f7", color: "#a855f7" }}
          >
            Manage Hive Swarms
          </button>
          <button 
            onClick={() => setShowCreator((current) => !current)} 
            className="gc-button gc-button-primary"
            style={{ padding: "0.6rem 1rem" }}
          >
            {showCreator ? "Exit Creator" : "Instantiate Sub-Agent"}
          </button>
          <button 
            onClick={() => setChatMode("direct")} 
            className="gc-button"
            style={{ padding: "0.6rem 1rem" }}
          >
            Direct Control Mode
          </button>
        </div>
      </section>

      {/* Main Content Area: Split View */}
      <section style={{ display: "grid", gridTemplateColumns: "350px minmax(0, 1fr)", gap: "1.2rem", alignItems: "start" }}>
        {/* Agent Tree Sidebar */}
        <div className="gc-card gc-scroll" style={{ padding: "1.2rem", position: "sticky", top: "72px", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--gc-muted)" }}>Agent Registry</strong>
            <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>{agents.length} total</span>
          </div>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={selectedAgentId === agent.id ? "" : "gc-card-interactive"}
                style={{
                  border: "1px solid",
                  borderColor: selectedAgentId === agent.id ? "var(--gc-primary)" : "var(--gc-border)",
                  borderRadius: "10px",
                  padding: "0.8rem",
                  textAlign: "left",
                  background: selectedAgentId === agent.id ? "rgba(0, 191, 165, 0.1)" : "transparent",
                  cursor: "pointer",
                  display: "grid",
                  gap: "0.25rem",
                  transition: "all 120ms"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: selectedAgentId === agent.id ? "var(--gc-primary)" : "inherit" }}>
                    {agent.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className={`gc-status-dot`} style={{ background: statusColor(agent.status), margin: 0, width: "6px", height: "6px" }}></span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: statusColor(agent.status) }}>
                      {agent.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--gc-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {agent.parentId ? `${agent.parentId.slice(0, 6)} → ${agent.id.slice(0, 12)}` : agent.id}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Detail / Config Area */}
        <div style={{ display: "grid", gap: "1.2rem" }}>
          {showCreator ? (
            <section className="gc-card" style={{ padding: "1.5rem", border: "1px solid var(--gc-primary)" }}>
              <form onSubmit={createSubAgent} style={{ display: "grid", gap: "1.2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "1.1rem" }}>Sub-Agent Visual Editor</strong>
                  <span className="gc-badge">Inheritance: Subordination Layer</span>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Display Name</span>
                    <input 
                      value={creator.label} 
                      onChange={(event) => setCreator((current) => ({ ...current, label: event.target.value }))} 
                      placeholder="e.g. Research Specialist" 
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem 0.8rem", background: "var(--gc-surface)" }} 
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Parent Authority</span>
                    <select 
                      value={creator.parentId} 
                      onChange={(event) => setCreator((current) => ({ ...current, parentId: event.target.value }))} 
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem 0.8rem", background: "var(--gc-surface)" }}
                    >
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.label || agent.id}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Provider Override</span>
                    <select 
                      value={creator.provider} 
                      onChange={(event) => setCreator((current) => ({ ...current, provider: event.target.value }))} 
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem 0.8rem", background: "var(--gc-surface)" }}
                    >
                      <option value="">Default (Workspace)</option>
                      {providerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Target Model</span>
                    <input 
                      value={creator.model} 
                      onChange={(event) => setCreator((current) => ({ ...current, model: event.target.value }))} 
                      placeholder="e.g. gpt-4o" 
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem 0.8rem", background: "var(--gc-surface)" }} 
                    />
                  </label>
                </div>

                <label style={{ display: "grid", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)" }}>Cognitive Objective (System Prompt)</span>
                  <textarea 
                    value={creator.systemPrompt} 
                    onChange={(event) => setCreator((current) => ({ ...current, systemPrompt: event.target.value }))} 
                    placeholder="Describe the primary function of this sub-agent..." 
                    style={{ minHeight: "80px", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem 0.8rem", background: "var(--gc-surface)", resize: "vertical" }} 
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.8rem" }}>
                  <div className="gc-card" style={{ padding: "0.8rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.6rem" }}>Tool Capability Attachment</div>
                    <div style={{ display: "grid", gap: "0.4rem", maxHeight: "140px", overflowY: "auto" }} className="gc-scroll">
                      {tools.map((tool) => (
                        <label key={tool.id} style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.8rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={creator.enabledTools.includes(tool.id)}
                            onChange={(event) => setCreator((curr) => ({
                              ...curr,
                              enabledTools: event.target.checked ? [...curr.enabledTools, tool.id] : curr.enabledTools.filter(t => t !== tool.id)
                            }))}
                          />
                          <span>{tool.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="gc-card" style={{ padding: "0.8rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.6rem" }}>Core Skill Attachment</div>
                    <div style={{ display: "grid", gap: "0.4rem", maxHeight: "140px", overflowY: "auto" }} className="gc-scroll">
                      {skills.map((skill) => (
                        <label key={skill.id} style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.8rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={creator.enabledSkills.includes(skill.id)}
                            onChange={(event) => setCreator((curr) => ({
                              ...curr,
                              enabledSkills: event.target.checked ? [...curr.enabledSkills, skill.id] : curr.enabledSkills.filter(s => s !== skill.id)
                            }))}
                          />
                          <span>{skill.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                  <button type="button" onClick={() => setShowCreator(false)} className="gc-button">Cancel</button>
                  <button type="submit" className="gc-button gc-button-primary">Spawn Agent</button>
                </div>
              </form>
            </section>
          ) : null}

          <div className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
            {!activeAgent ? (
              <div style={{ padding: "4rem", textAlign: "center", color: "var(--gc-muted)" }}>
                Select an agent from the registry to view or modify its cognitive profile.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600 }}>{activeAgent.label}</h2>
                    <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.4rem", fontSize: "0.85rem", color: "var(--gc-muted)" }}>
                      <span style={{ fontFamily: "var(--font-mono)" }}>ID: {activeAgent.id}</span>
                      <span>•</span>
                      <span>Workspace: {workspaceId}</span>
                    </div>
                    <div style={{ marginTop: "0.8rem", display: "flex", gap: "1rem" }}>
                      <div className="gc-badge" style={{ fontSize: "0.65rem" }}>
                        step: {liveStepByAgent[activeAgent.id] || "idle"}
                      </div>
                      <div className="gc-badge" style={{ fontSize: "0.65rem" }}>
                        iter: {liveIterationByAgent[activeAgent.id] || 0}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <ActionButton label="Save Configuration" run={saveAgent} />
                    <button
                      onClick={() => setStatus(activeAgent.id, activeAgent.status === "paused" ? "active" : "paused")}
                      className="gc-button"
                    >
                      {activeAgent.status === "paused" ? "Resume" : "Pause"}
                    </button>
                    {activeAgent.id !== "main" && (
                      <button onClick={() => deleteAgent(activeAgent.id)} className="gc-button" style={{ color: "var(--gc-danger)" }}>Delete</button>
                    )}
                    <Link href={`/chat?agentId=${encodeURIComponent(activeAgent.id)}`} className="gc-button gc-button-primary">
                      Direct Chat
                    </Link>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
                  <div style={{ display: "grid", gap: "1.2rem" }}>
                    <label style={{ display: "grid", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>System Prompt Override</span>
                      <textarea 
                        value={form.systemPromptOverride} 
                        onChange={(e) => setForm(c => ({...c, systemPromptOverride: e.target.value}))}
                        style={{ minHeight: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)", resize: "vertical" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Cognitive SOUL Override</span>
                      <textarea 
                        value={form.soulOverride} 
                        onChange={(e) => setForm(c => ({...c, soulOverride: e.target.value}))}
                        style={{ minHeight: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)", resize: "vertical" }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: "1.2rem", alignContent: "start" }}>
                    <div className="gc-card" style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
                      <h3 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gc-muted)" }}>Model Parameters</h3>
                      
                      <div style={{ display: "grid", gap: "0.8rem" }}>
                        <label style={{ display: "grid", gap: "0.3rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Provider</span>
                          <select 
                            value={form.provider} 
                            onChange={(e) => setForm(c => ({...c, provider: e.target.value as any}))}
                            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)" }}
                          >
                            <option value="">inherited: workspace default</option>
                            {providerOptions.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: "0.3rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Model ID</span>
                          <input 
                            value={form.model} 
                            onChange={(e) => setForm(c => ({...c, model: e.target.value}))}
                            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)" }}
                          />
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                          <label style={{ display: "grid", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Temp</span>
                            <input 
                              value={form.temperature} 
                              onChange={(e) => setForm(c => ({...c, temperature: e.target.value}))}
                              style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)" }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Tokens</span>
                            <input 
                              value={form.maxTokens} 
                              onChange={(e) => setForm(c => ({...c, maxTokens: e.target.value}))}
                              style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)" }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="gc-card" style={{ padding: "1rem" }}>
                      <h3 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "purple", marginBottom: "1rem" }}>Acoustic Identity (Voice)</h3>
                      <div style={{ display: "grid", gap: "1rem" }}>
                        <label style={{ display: "grid", gap: "0.3rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>ElevenLabs Voice</span>
                          <select 
                            value={form.voiceId} 
                            onChange={(e) => setForm(c => ({...c, voiceId: e.target.value}))}
                            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--gc-border)", background: "var(--gc-bg-soft)" }}
                          >
                            <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Default)</option>
                            <option value="AZnzlk1XvdvUe3BnEsbe">Domi</option>
                            <option value="EXAVITQu4vr4xnNLMQix">Bella</option>
                            <option value="MF3mGyEYCl7XYW7Lec6n">Josh</option>
                            <option value="piTKp9D9B75U16qXvT9n">Serena</option>
                            <option value="ZQe5CZvH8A3UBebv8uVv">James</option>
                          </select>
                        </label>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                          <label style={{ display: "grid", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Stability ({form.voiceStability})</span>
                            <input 
                              type="range" min="0" max="1" step="0.05"
                              value={form.voiceStability} 
                              onChange={(e) => setForm(c => ({...c, voiceStability: e.target.value}))}
                              style={{ width: "100%" }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Boost ({form.voiceSimilarityBoost})</span>
                            <input 
                              type="range" min="0" max="1" step="0.05"
                              value={form.voiceSimilarityBoost} 
                              onChange={(e) => setForm(c => ({...c, voiceSimilarityBoost: e.target.value}))}
                              style={{ width: "100%" }}
                            />
                          </label>
                        </div>
                        
                        <button
                          type="button"
                          onClick={async () => {
                            if (!activeAgent) return;
                            await fetch("/api/voice/speak", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                text: `System online. I am ${activeAgent.label}. Voice transmission initialized.`,
                                voiceId: form.voiceId,
                                stability: Number(form.voiceStability),
                                similarityBoost: Number(form.voiceSimilarityBoost)
                              })
                            });
                          }}
                          className="gc-button"
                          style={{ fontSize: "0.7rem", padding: "0.4rem" }}
                        >
                          Speak Sample
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Matrix: Tools & Skills */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="gc-card" style={{ padding: "1.2rem" }}>
                    <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: "1rem" }}>Granted Capability: Tools</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.6rem", maxHeight: "250px", overflowY: "auto" }} className="gc-scroll">
                      {tools.map((tool) => (
                        <label key={tool.id} className="gc-card-interactive" style={{ 
                          display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--gc-border)", fontSize: "0.78rem", cursor: "pointer" 
                        }}>
                          <input
                            type="checkbox"
                            checked={form.enabledTools.includes(tool.id)}
                            onChange={(e) => setForm(c => ({
                              ...c,
                              enabledTools: e.target.checked ? [...c.enabledTools, tool.id] : c.enabledTools.filter(id => id !== tool.id)
                            }))}
                          />
                          <span style={{ fontFamily: "var(--font-mono)" }}>{tool.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="gc-card" style={{ padding: "1.2rem" }}>
                    <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: "1rem" }}>Granted Capability: Skills</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.6rem", maxHeight: "250px", overflowY: "auto" }} className="gc-scroll">
                      {skills.map((skill) => (
                        <label key={skill.id} className="gc-card-interactive" style={{ 
                          display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--gc-border)", fontSize: "0.78rem", cursor: "pointer" 
                        }}>
                          <input
                            type="checkbox"
                            checked={form.enabledSkills.includes(skill.id)}
                            onChange={(e) => setForm(c => ({
                              ...c,
                              enabledSkills: e.target.checked ? [...c.enabledSkills, skill.id] : c.enabledSkills.filter(id => id !== skill.id)
                            }))}
                          />
                          <span>{skill.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "0.8rem", border: "1px solid var(--gc-border)", borderRadius: "8px", background: "rgba(0, 191, 165, 0.03)", fontSize: "0.85rem", color: "var(--gc-muted)" }}>
                  Operational telemetry for this agent is active in <Link href="/canvas" style={{ color: "var(--gc-primary)", textDecoration: "underline" }}>Canvas</Link>.
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {statusText ? (
        <section className="gc-card" style={{ padding: "1rem", position: "fixed", bottom: "2rem", right: "2rem", minWidth: "300px", zIndex: 1000, border: "1px solid var(--gc-primary)", background: "var(--gc-surface)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem" }}>{statusText}</span>
            <button onClick={() => setStatusText("")} style={{ background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer" }}>✕</button>
          </div>
        </section>
      ) : null}

      {showHiveWizard && (
        <HiveCreationWizard 
          agents={agents} 
          onClose={() => setShowHiveWizard(false)} 
          onCreated={(id) => {
            setShowHiveWizard(false);
            setStatusText(`Hive ${id} created successfully.`);
            loadAgents();
          }}
        />
      )}
    </div>
  );
}
