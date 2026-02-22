"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { CallPanel } from "@/src/ui/components/agents/call-panel";
import { ForgePanel } from "@/src/ui/components/agents/forge-panel";
import { ProactivePanel } from "@/src/ui/components/agents/proactive-panel";
import { useControlStore } from "@/src/ui/state/control-store";

interface GlobalSettings {
  "global.iterationLimit": string;
  "global.reflectionEnabled": string;
  "global.maxTokenLimit": string;
  "global.costThresholdUsd": string;
  "global.autoSpawnEnabled": string;
  "global.proactiveEnabled": string;
  "global.security.requireDangerousConfirmation": string;
}

const defaultSettings: GlobalSettings = {
  "global.iterationLimit": "6",
  "global.reflectionEnabled": "true",
  "global.maxTokenLimit": "4000",
  "global.costThresholdUsd": "10",
  "global.autoSpawnEnabled": "true",
  "global.proactiveEnabled": "false",
  "global.security.requireDangerousConfirmation": "true"
};

export function SettingsPage() {
  const { events } = useControlStore();
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const payload = (await response.json()) as { settings?: Partial<GlobalSettings> };
    setSettings({
      ...defaultSettings,
      ...(payload.settings ?? {})
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type === "settings.updated") {
      load();
    }
  }, [events, load]);

  async function save() {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to save settings.");
    }
    setStatus(`Saved ${payload.updated?.length ?? 0} settings.`);
    await load();
  }

  function setValue(key: keyof GlobalSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>System Control & Orchestration</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Manage global runtime limits, reflection policies, security thresholds, and proactive agent behaviors.
          </div>
        </div>
        <button onClick={save} className="gc-button gc-button-primary" style={{ padding: "0.6rem 1.2rem" }}>
           Save All Changes
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
         {/* Global Config Card */}
         <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--gc-primary)" }}>Core Configuration</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
               <div style={{ display: "grid", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", fontWeight: 600 }}>ITERATION LIMIT</span>
                  <input 
                    type="number"
                    value={settings["global.iterationLimit"]} 
                    onChange={(e) => setValue("global.iterationLimit", e.target.value)} 
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.9rem" }} 
                  />
                  <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>Max steps per agent run loop.</div>
               </div>

               <div style={{ display: "grid", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", fontWeight: 600 }}>MAX TOKEN LIMIT</span>
                  <input 
                    type="number"
                    value={settings["global.maxTokenLimit"]} 
                    onChange={(e) => setValue("global.maxTokenLimit", e.target.value)} 
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.9rem" }} 
                  />
                  <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>Maximum context per interaction.</div>
               </div>

               <div style={{ display: "grid", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", fontWeight: 600 }}>COST THRESHOLD (USD)</span>
                  <input 
                    type="number"
                    value={settings["global.costThresholdUsd"]} 
                    onChange={(e) => setValue("global.costThresholdUsd", e.target.value)} 
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.9rem" }} 
                  />
                  <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>Monthly burn limit warning level.</div>
               </div>

               <div style={{ display: "grid", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", fontWeight: 600 }}>REFLECTION MODE</span>
                  <select 
                    value={settings["global.reflectionEnabled"]} 
                    onChange={(e) => setValue("global.reflectionEnabled", e.target.value)} 
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.9rem" }}
                  >
                     <option value="true">ENABLED (Recommended)</option>
                     <option value="false">DISABLED</option>
                  </select>
                  <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>Agents critique their own steps.</div>
               </div>
            </div>

            <div style={{ display: "grid", gap: "1rem", borderTop: "1px solid var(--gc-border)", paddingTop: "1.5rem" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Autonomous Spawning</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Allow agents to delegate sub-tasks dynamically.</div>
                  </div>
                  <select 
                    value={settings["global.autoSpawnEnabled"]} 
                    onChange={(e) => setValue("global.autoSpawnEnabled", e.target.value)}
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "6px", padding: "0.4rem", background: "var(--gc-surface)", fontSize: "0.8rem", color: "inherit" }}
                  >
                    <option value="true">YES</option>
                    <option value="false">NO</option>
                  </select>
               </div>

               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Proactive Orchestration</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Enable background monitoring and agent promptness.</div>
                  </div>
                  <select 
                    value={settings["global.proactiveEnabled"]} 
                    onChange={(e) => setValue("global.proactiveEnabled", e.target.value)}
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "6px", padding: "0.4rem", background: "var(--gc-surface)", fontSize: "0.8rem", color: "inherit" }}
                  >
                    <option value="true">ENABLED</option>
                    <option value="false">DISABLED</option>
                  </select>
               </div>

               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Security Confirmation</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Require explicit approval for "dangerous" tool use.</div>
                  </div>
                  <select 
                    value={settings["global.security.requireDangerousConfirmation"]} 
                    onChange={(e) => setValue("global.security.requireDangerousConfirmation", e.target.value)}
                    style={{ border: "1px solid var(--gc-border)", borderRadius: "6px", padding: "0.4rem", background: "var(--gc-surface)", fontSize: "0.8rem", color: "inherit" }}
                  >
                    <option value="true">STRICT (Required)</option>
                    <option value="false">LENIENT (Auto-run)</option>
                  </select>
               </div>
            </div>
         </section>

         {/* Right Column: Other Panels */}
         <div style={{ display: "grid", gap: "1.2rem", alignContent: "start" }}>
            <ForgePanel />
            <div className="gc-card" style={{ padding: "1.5rem" }}>
               <ProactivePanel />
            </div>
            <div className="gc-card" style={{ padding: "1.5rem" }}>
               <CallPanel />
            </div>
         </div>
      </div>

      {status ? (
        <div style={{ position: "fixed", bottom: "2rem", right: "2rem", padding: "0.8rem 1.2rem", background: "var(--gc-surface)", border: "1px solid var(--gc-primary)", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", zIndex: 1000, color: "var(--gc-primary)", fontSize: "0.9rem" }}>
          {status}
          <button onClick={() => setStatus("")} style={{ marginLeft: "1rem", background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer" }}>✕</button>
        </div>
      ) : null}
    </div>
  );
}
