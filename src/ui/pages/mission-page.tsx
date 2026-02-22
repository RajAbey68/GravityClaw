"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AgentDescriptor } from "@/src/core/types";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore, type LiveSystemEvent } from "@/src/ui/state/control-store";
import { LiveFeed } from "@/src/ui/components/live-feed/LiveFeed";

type MissionStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type MissionPriority = "low" | "medium" | "high" | "critical";

interface MissionTask {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: MissionStatus;
  priority: MissionPriority;
  assigned_agent_id: string | null;
  required_skills: string[];
  tags: string[];
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  deliverables: Array<Record<string, unknown>>;
}

const statusColumns: Array<{ status: MissionStatus; label: string }> = [
  { status: "inbox", label: "Incoming" },
  { status: "assigned", label: "Assigned" },
  { status: "in_progress", label: "Executing" },
  { status: "review", label: "Review" },
  { status: "done", label: "Completed" }
];

function statusDotColor(status: AgentDescriptor["status"]) {
  if (status === "busy" || status === "active") return "var(--gc-primary)";
  if (status === "error") return "var(--gc-danger)";
  if (status === "paused") return "#f59e0b";
  return "rgba(255,255,255,0.2)";
}

function priorityColor(priority: MissionPriority) {
  if (priority === "critical") return "var(--gc-danger)";
  if (priority === "high") return "#ff7a45";
  if (priority === "medium") return "var(--gc-primary)";
  return "var(--gc-muted)";
}

function eventWorkspace(event: LiveSystemEvent) {
  const record = event as Record<string, unknown>;
  if (typeof record.workspaceId === "string" && record.workspaceId.trim()) return record.workspaceId.trim();
  return "default";
}

export function MissionPage() {
  const { workspaceId, events } = useControlStore();
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [tasks, setTasks] = useState<MissionTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as MissionPriority,
    assignedAgentId: "",
    requiredSkills: "",
    tags: ""
  });

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const loadAgents = useCallback(async () => {
    const response = await fetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = await response.json();
    setAgents(payload.agents ?? []);
  }, [workspaceId]);

  const loadTasks = useCallback(async () => {
    const response = await fetch(`/api/mission/tasks?workspaceId=${encodeURIComponent(workspaceId)}&limit=500`, { cache: "no-store" });
    const payload = await response.json();
    setTasks(payload.tasks ?? []);
  }, [workspaceId]);

  useEffect(() => {
    loadAgents();
    loadTasks();
  }, [loadAgents, loadTasks]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    
    if (["mission.task", "agent.status.changed", "agent.spawned"].includes(latest.type)) {
      loadTasks();
      loadAgents();
    }
  }, [events, loadTasks, loadAgents]);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    const response = await fetch("/api/mission/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        ...form,
        requiredSkills: form.requiredSkills.split(",").map(s => s.trim()).filter(Boolean),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean)
      })
    });
    if (response.ok) {
      setShowCreateModal(false);
      setForm({ title: "", description: "", priority: "medium", assignedAgentId: "", requiredSkills: "", tags: "" });
      loadTasks();
    }
  }

  async function moveTask(taskId: string, nextStatus: MissionStatus) {
    await fetch(`/api/mission/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    loadTasks();
  }

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("taskId", id);
  }

  function onDrop(e: React.DragEvent, status: MissionStatus) {
    const id = e.dataTransfer.getData("taskId");
    if (id) moveTask(id, status);
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
           <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Mission Control</h1>
            <span className="gc-badge">CORE_OPERATIONS</span>
          </div>
          <p style={{ color: "var(--gc-muted)", fontSize: "0.85rem", margin: "0.4rem 0 0 0" }}>
            Multi-agent project orchestration and task lifecycle management.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.8rem" }}>
          <button onClick={() => setShowCreateModal(true)} className="gc-button" style={{ padding: "0.5rem 1rem", background: "var(--gc-primary)", color: "#000", fontWeight: 600 }}>
            + Create Mission
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.2rem", alignItems: "start" }}>
        {/* Sidebar: Agents & Feed */}
        <aside style={{ display: "grid", gap: "1.2rem" }}>
          <div className="gc-card" style={{ padding: "1.2rem" }}>
            <h2 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent Roster</h2>
            <div className="gc-scroll" style={{ display: "grid", gap: "0.6rem", maxHeight: "40vh", overflowY: "auto" }}>
              {agents.map(agent => (
                <div key={agent.id} className="gc-card" style={{ padding: "0.8rem", background: "rgba(255,255,255,0.02)", border: "1px solid var(--gc-border)" }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{agent.label}</span>
                      <div style={{ 
                        width: "10px", height: "10px", borderRadius: "50%", 
                        background: statusDotColor(agent.status),
                        boxShadow: agent.status === "busy" ? `0 0 10px ${statusDotColor(agent.status)}` : "none"
                      }} />
                   </div>
                   <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)", marginTop: "0.2rem", fontFamily: "var(--font-mono)" }}>{agent.id}</div>
                </div>
              ))}
            </div>
          </div>

          <LiveFeed workspaceId={workspaceId} maxHeight="40vh" />
        </aside>

        {/* Main: Kanban Board */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", overflowX: "auto" }}>
          {statusColumns.map(col => (
            <div 
              key={col.status} 
              onDragOver={e => e.preventDefault()}
              onDrop={e => onDrop(e, col.status)}
              style={{ minHeight: "80vh", display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--gc-muted)" }}>{col.label}</h3>
                <span className="gc-badge" style={{ background: "rgba(255,255,255,0.05)" }}>{tasks.filter(t => t.status === col.status).length}</span>
              </div>
              
              <div className="gc-scroll" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {tasks.filter(t => t.status === col.status).map(task => (
                  <div 
                    key={task.id} 
                    draggable 
                    onDragStart={e => onDragStart(e, task.id)}
                    className="gc-card" 
                    style={{ 
                      padding: "1rem", 
                      cursor: "grab", 
                      background: "rgba(255,255,255,0.03)", 
                      border: `1px solid ${task.id === selectedTaskId ? "var(--gc-primary)" : "var(--gc-border)"}`,
                      borderLeft: `3px solid ${priorityColor(task.priority)}`
                    }}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>{task.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)", lineHeight: "1.4" }}>
                      {task.description ? (task.description.length > 80 ? task.description.slice(0, 80) + "..." : task.description) : "No description."}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                       <span style={{ fontSize: "0.65rem", color: "var(--gc-muted)", textTransform: "uppercase", fontWeight: 700 }}>{task.priority}</span>
                       <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem" }}>
                          {task.assigned_agent_id ? "A" : "?"}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </section>

      {/* Detail Panel Placeholder */}
      {selectedTask && (
        <div style={{ position: "fixed", top: "48px", right: 0, width: "400px", height: "calc(100vh - 48px)", background: "var(--gc-bg)", borderLeft: "1px solid var(--gc-border)", zIndex: 100, padding: "2rem", boxShadow: "-10px 0 30px rgba(0,0,0,0.5)" }}>
           <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem" }}>
              <span className="gc-badge" style={{ color: priorityColor(selectedTask.priority) }}>{selectedTask.priority.toUpperCase()} PRIORITY</span>
              <button onClick={() => setSelectedTaskId("")} style={{ background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
           </div>
           <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>{selectedTask.title}</h2>
           <p style={{ color: "var(--gc-muted)", lineHeight: "1.6", marginBottom: "2rem" }}>{selectedTask.description}</p>
           
           <div style={{ display: "grid", gap: "1.5rem" }}>
              <div>
                 <h4 style={{ fontSize: "0.8rem", color: "var(--gc-muted)", marginBottom: "0.5rem" }}>ASSIGNED AGENT</h4>
                 <div className="gc-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.03)" }}>
                    {selectedTask.assigned_agent_id || "Unassigned"}
                 </div>
              </div>
              <div>
                 <h4 style={{ fontSize: "0.8rem", color: "var(--gc-muted)", marginBottom: "0.5rem" }}>REQUIRED SKILLS</h4>
                 <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {selectedTask.required_skills.map(s => <span key={s} className="gc-badge">{s}</span>)}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="gc-card" style={{ width: "500px", padding: "2rem", display: "grid", gap: "1.5rem" }}>
            <h2 style={{ margin: 0 }}>Create Mission</h2>
            <form onSubmit={createTask} style={{ display: "grid", gap: "1rem" }}>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Task Title" style={{ width: "100%", padding: "0.8rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", borderRadius: "8px", color: "#fff" }} />
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description" style={{ width: "100%", height: "100px", padding: "0.8rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", borderRadius: "8px", color: "#fff" }} />
              <div style={{ display: "flex", gap: "1rem" }}>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})} style={{ flex: 1, padding: "0.8rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", borderRadius: "8px", color: "#fff" }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <input value={form.requiredSkills} onChange={e => setForm({...form, requiredSkills: e.target.value})} placeholder="Skills (csv)" style={{ flex: 1, padding: "0.8rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", borderRadius: "8px", color: "#fff" }} />
              </div>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <button type="submit" className="gc-button" style={{ flex: 1, padding: "0.8rem", background: "var(--gc-primary)", color: "#000", fontWeight: 600 }}>Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="gc-button" style={{ flex: 1, padding: "0.8rem" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
