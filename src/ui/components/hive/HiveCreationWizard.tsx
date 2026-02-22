"use client";

import { useState, useCallback } from "react";
import { type AgentDescriptor } from "@/src/core/types";
import { useControlStore } from "@/src/ui/state/control-store";

interface HiveCreationWizardProps {
  agents: AgentDescriptor[];
  onClose: () => void;
  onCreated: (hiveId: string) => void;
}

export function HiveCreationWizard({ agents, onClose, onCreated }: HiveCreationWizardProps) {
  const { workspaceId } = useControlStore();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/hives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, workspaceId })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to create hive");

      const hiveId = data.hive.id;

      // Add members
      for (const agentId of selectedAgents) {
        await fetch(`/api/hives/${hiveId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "add-member", 
            agentId, 
            role: roles[agentId] || "member" 
          })
        });
      }

      onCreated(hiveId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [name, workspaceId, selectedAgents, roles, onCreated]);

  return (
    <div style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(0,0,0,0.85)", 
      backdropFilter: "blur(10px)",
      zIndex: 2000, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      padding: "2rem"
    }}>
      <div className="gc-card" style={{ 
        width: "100%", 
        maxWidth: "600px", 
        padding: "2.5rem", 
        display: "grid", 
        gap: "2rem",
        background: "rgba(15, 25, 35, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 20px 80px rgba(0,0,0,0.5)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Hive Orchestration</h2>
            <p style={{ color: "var(--gc-muted)", fontSize: "0.85rem", margin: "0.4rem 0 0 0" }}>
              Phase {step} of 2: {step === 1 ? "Swarm Foundation" : "Role Allocation"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer", fontSize: "1.5rem" }}>×</button>
        </div>

        {error && (
          <div style={{ padding: "1rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--gc-danger)", color: "var(--gc-danger)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <label style={{ display: "grid", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Hive Designation</span>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Project 'Icarus' Analytics Swarm"
                style={{ width: "100%", padding: "0.8rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", borderRadius: "8px", color: "#fff" }}
              />
            </label>

            <div>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.8rem" }}>Select Swarm Members</span>
              <div className="gc-scroll" style={{ display: "grid", gap: "0.6rem", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                {agents.map(agent => (
                  <label key={agent.id} className="gc-card-interactive" style={{ 
                    display: "flex", 
                    gap: "1rem", 
                    alignItems: "center", 
                    padding: "0.8rem", 
                    borderRadius: "10px", 
                    border: `1px solid ${selectedAgents.includes(agent.id) ? "var(--gc-primary)" : "var(--gc-border)"}`,
                    background: selectedAgents.includes(agent.id) ? "rgba(0, 191, 165, 0.05)" : "transparent",
                    cursor: "pointer"
                  }}>
                    <input 
                      type="checkbox" 
                      checked={selectedAgents.includes(agent.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedAgents([...selectedAgents, agent.id]);
                        else setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{agent.label}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontFamily: "var(--font-mono)" }}>{agent.id}</div>
                    </div>
                    <span className="gc-badge" style={{ fontSize: "0.6rem" }}>{agent.status}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Allocate Swarm Roles</div>
            <div className="gc-scroll" style={{ display: "grid", gap: "1rem", maxHeight: "350px", overflowY: "auto", paddingRight: "4px" }}>
              {selectedAgents.map(agentId => {
                const agent = agents.find(a => a.id === agentId);
                return (
                  <div key={agentId} style={{ display: "grid", gap: "0.6rem", padding: "1rem", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--gc-border)" }}>
                    <div style={{ fontWeight: 600 }}>{agent?.label || agentId}</div>
                    <select 
                      value={roles[agentId] || "member"}
                      onChange={(e) => setRoles({...roles, [agentId]: e.target.value})}
                      style={{ padding: "0.6rem", background: "rgba(0,0,0,0.2)", border: "1px solid var(--gc-border)", borderRadius: "6px", color: "#fff" }}
                    >
                      <option value="member">General Member</option>
                      <option value="coordinator">Coordinator / Lead</option>
                      <option value="researcher">Research Specialist</option>
                      <option value="executor">Code Executor</option>
                      <option value="reviewer">Peer Reviewer</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          {step === 1 ? (
            <button 
              disabled={!name || selectedAgents.length === 0}
              onClick={() => setStep(2)}
              className="gc-button gc-button-primary"
              style={{ flex: 1, padding: "1rem" }}
            >
              Next: Assign Roles
            </button>
          ) : (
            <>
              <button 
                onClick={() => setStep(1)}
                className="gc-button"
                style={{ flex: 1, padding: "1rem" }}
              >
                Back
              </button>
              <button 
                disabled={loading}
                onClick={handleCreate}
                className="gc-button gc-button-primary"
                style={{ flex: 1, padding: "1rem" }}
              >
                {loading ? "Activating Hive..." : "Instantiate Swarm"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
