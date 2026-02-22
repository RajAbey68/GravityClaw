"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore } from "@/src/ui/state/control-store";

interface WorkspaceRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

export function WorkspacePage() {
  const { workspaceId, setWorkspaceId, workspaces, refreshWorkspaces } = useControlStore();
  const [configs, setConfigs] = useState<WorkspaceConfigRow[]>([]);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [configKey, setConfigKey] = useState("workspace.defaultMode");
  const [configValue, setConfigValue] = useState("direct");
  const [status, setStatus] = useState("");
  const [exportDump, setExportDump] = useState("");

  const loadConfigs = useCallback(async () => {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/configs`, { cache: "no-store" });
    const payload = (await response.json()) as { configs?: WorkspaceConfigRow[] };
    setConfigs(payload.configs ?? []);
  }, [workspaceId]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createName.trim()) return;
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: createName.trim(),
        description: createDescription.trim() || undefined
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Failed to create workspace.");
      return;
    }
    await refreshWorkspaces();
    setWorkspaceId(payload.workspaceId);
    setCreateName("");
    setCreateDescription("");
    setStatus(`Created workspace '${payload.workspaceId}'.`);
  }

  async function cloneWorkspace() {
    if (!cloneName.trim()) {
      setStatus("Provide clone name.");
      return;
    }
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "clone",
        sourceWorkspaceId: workspaceId,
        targetName: cloneName.trim()
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to clone workspace.");
    }
    await refreshWorkspaces();
    setWorkspaceId(payload.workspaceId);
    setCloneName("");
    setStatus(`Cloned to workspace '${payload.workspaceId}'.`);
  }

  async function deleteWorkspace(targetWorkspaceId: string) {
    if (targetWorkspaceId === "default") {
      setStatus("Default workspace cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete workspace '${targetWorkspaceId}'?`)) return;
    const response = await fetch(`/api/workspaces/${encodeURIComponent(targetWorkspaceId)}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Failed to delete workspace.");
      return;
    }
    await refreshWorkspaces();
    if (workspaceId === targetWorkspaceId) {
      setWorkspaceId("default");
    }
    setStatus(`Deleted workspace '${targetWorkspaceId}'.`);
  }

  async function exportWorkspace() {
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "export", workspaceId })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Failed to export workspace.");
      return;
    }
    setExportDump(JSON.stringify(payload, null, 2));
  }

  async function saveConfig() {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/configs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: configKey.trim(), value: configValue })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to save config.");
    }
    await loadConfigs();
    setStatus(`Saved config '${configKey}' in workspace '${workspaceId}'.`);
  }

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <section className="gc-card" style={{ padding: "0.85rem" }}>
        <strong>Workspace</strong>
        <div style={{ color: "var(--gc-muted)", fontSize: "0.78rem", marginTop: "0.2rem" }}>
          Isolated environments with separate agents, memory namespaces, tool policy, and skill configuration.
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: "0.7rem" }}>
        <div className="gc-card" style={{ padding: "0.7rem", display: "grid", gap: "0.45rem" }}>
          <strong style={{ fontSize: "0.86rem" }}>Workspace List</strong>
          <div style={{ display: "grid", gap: "0.35rem", maxHeight: "420px", overflowY: "auto" }}>
            {workspaces.map((workspace: WorkspaceRecord) => (
              <div key={workspace.id} style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.4rem", display: "grid", gap: "0.25rem" }}>
                <button
                  onClick={() => setWorkspaceId(workspace.id)}
                  style={{
                    border: "1px solid var(--gc-border)",
                    borderRadius: "8px",
                    padding: "0.35rem 0.4rem",
                    textAlign: "left",
                    background: workspace.id === workspaceId ? "rgba(25, 209, 195, 0.12)" : "var(--gc-bg-soft)",
                    cursor: "pointer"
                  }}
                >
                  <div>{workspace.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--gc-muted)" }}>
                    {workspace.id}
                  </div>
                </button>
                <button onClick={() => deleteWorkspace(workspace.id)} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.3rem 0.4rem", cursor: "pointer", background: "transparent", color: "var(--gc-muted)", fontSize: "0.74rem" }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.7rem" }}>
          <form onSubmit={createWorkspace} className="gc-card" style={{ padding: "0.75rem", display: "grid", gap: "0.45rem" }}>
            <strong style={{ fontSize: "0.86rem" }}>Create Workspace</strong>
            <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Workspace name" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", background: "var(--gc-bg-soft)" }} />
            <input value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="Description (optional)" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", background: "var(--gc-bg-soft)" }} />
            <button type="submit" style={{ border: "1px solid var(--gc-primary-soft)", borderRadius: "8px", padding: "0.42rem 0.6rem", cursor: "pointer", background: "rgba(25, 209, 195, 0.12)" }}>
              Create
            </button>
          </form>

          <section className="gc-card" style={{ padding: "0.75rem", display: "grid", gap: "0.45rem" }}>
            <strong style={{ fontSize: "0.86rem" }}>Clone / Export</strong>
            <input value={cloneName} onChange={(event) => setCloneName(event.target.value)} placeholder={`Clone '${workspaceId}' to new workspace name`} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", background: "var(--gc-bg-soft)" }} />
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <ActionButton label="Clone Workspace" run={cloneWorkspace} />
              <button onClick={exportWorkspace} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.42rem 0.6rem", cursor: "pointer", background: "var(--gc-bg-soft)" }}>
                Export
              </button>
            </div>
            {exportDump ? (
              <textarea readOnly value={exportDump} style={{ minHeight: "180px", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.45rem", background: "var(--gc-bg-soft)", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }} />
            ) : null}
          </section>

          <section className="gc-card" style={{ padding: "0.75rem", display: "grid", gap: "0.45rem" }}>
            <strong style={{ fontSize: "0.86rem" }}>Workspace Config</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.4rem" }}>
              <input value={configKey} onChange={(event) => setConfigKey(event.target.value)} placeholder="key" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", background: "var(--gc-bg-soft)" }} />
              <input value={configValue} onChange={(event) => setConfigValue(event.target.value)} placeholder="value" style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", background: "var(--gc-bg-soft)" }} />
              <ActionButton label="Save" run={saveConfig} />
            </div>
            <div style={{ display: "grid", gap: "0.25rem", maxHeight: "170px", overflowY: "auto" }}>
              {configs.length === 0 ? (
                <div style={{ color: "var(--gc-muted)", fontSize: "0.78rem" }}>No workspace configs set.</div>
              ) : (
                configs.map((entry) => (
                  <div key={entry.key} style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.35rem 0.4rem", display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{entry.key}</span>
                    <span style={{ color: "var(--gc-muted)", fontSize: "0.72rem" }}>{entry.value}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      {status ? (
        <section className="gc-card" style={{ padding: "0.55rem", fontSize: "0.78rem", color: "var(--gc-muted)" }}>
          {status}
        </section>
      ) : null}
    </div>
  );
}

