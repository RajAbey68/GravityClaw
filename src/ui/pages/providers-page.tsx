"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderId } from "@/src/core/providers/types";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore } from "@/src/ui/state/control-store";

type ProviderEnvKey =
  | "OPENAI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "GEMINI_API_KEY"
  | "XAI_API_KEY"
  | "DEEPSEEK_API_KEY"
  | "GROQ_API_KEY"
  | "OPENROUTER_API_KEY";

interface ProviderState {
  providers: Array<{
    name: ProviderId;
    available: boolean;
    models: string[];
    health?: {
      state: "idle" | "ready" | "missing-key" | "error";
      lastAttemptAt?: string;
      lastSuccessAt?: string;
      lastError?: string;
      failureRate1h?: number;
    };
  }>;
  currentProvider: ProviderId;
  currentModel: string;
  failoverEnabled: boolean;
  failoverList?: Array<{ provider: ProviderId; model: string }>;
  keys: Record<string, { configured: boolean; masked: string }>;
}

const KEY_ENTRIES: Array<{ env: ProviderEnvKey; title: string; provider: ProviderId }> = [
  { env: "OPENAI_API_KEY", title: "OpenAI", provider: "openai" },
  { env: "ANTHROPIC_API_KEY", title: "Anthropic", provider: "anthropic" },
  { env: "GEMINI_API_KEY", title: "Google Gemini", provider: "gemini" },
  { env: "XAI_API_KEY", title: "xAI / Grok", provider: "xai" },
  { env: "DEEPSEEK_API_KEY", title: "DeepSeek", provider: "deepseek" },
  { env: "GROQ_API_KEY", title: "Groq", provider: "groq" },
  { env: "OPENROUTER_API_KEY", title: "OpenRouter", provider: "openrouter" }
];

function initialKeyInputs() {
  return {
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GEMINI_API_KEY: "",
    XAI_API_KEY: "",
    DEEPSEEK_API_KEY: "",
    GROQ_API_KEY: "",
    OPENROUTER_API_KEY: ""
  } as Record<ProviderEnvKey, string>;
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function ProvidersPage() {
  const { events } = useControlStore();
  const [state, setState] = useState<ProviderState | null>(null);
  const [status, setStatus] = useState("");
  const [keyInputs, setKeyInputs] = useState<Record<ProviderEnvKey, string>>(initialKeyInputs);
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({});
  const [failoverList, setFailoverList] = useState<Array<{ provider: ProviderId; model: string }>>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/providers", { cache: "no-store" });
    const payload = (await response.json()) as ProviderState;
    setState(payload);
    setFailoverList(payload.failoverList ?? []);
    setSelectedModel((current) => {
      const next = { ...current };
      for (const provider of payload.providers) {
        next[provider.name] =
          current[provider.name] ||
          (payload.currentProvider === provider.name ? payload.currentModel : "") ||
          provider.models[0] ||
          "";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type === "provider.config.changed") {
      load();
    }
  }, [events, load]);

  async function switchProvider(provider: ProviderId, model?: string) {
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, model })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to switch provider.");
    }
    await load();
    setStatus(`Switched provider to ${provider}/${model ?? payload.currentModel}.`);
  }

  async function toggleFailover() {
    if (!state) return;
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failoverEnabled: !state.failoverEnabled })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update failover.");
    }
    await load();
    setStatus(`Failover ${!state.failoverEnabled ? "enabled" : "disabled"}.`);
  }

  async function persistFailoverList(nextList: Array<{ provider: ProviderId; model: string }>) {
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failoverList: nextList })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update failover list.");
    }
    setFailoverList(nextList);
    await load();
    setStatus("Updated failover priority list.");
  }

  async function saveKey(providerKey: ProviderEnvKey) {
    const value = keyInputs[providerKey].trim();
    if (!value) {
      setStatus(`Provide value for ${providerKey}.`);
      return;
    }
    const response = await fetch("/api/providers/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerKey,
        value
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update key.");
    }
    setKeyInputs((current) => ({
      ...current,
      [providerKey]: ""
    }));
    setStatus(`Saved ${providerKey}. Value masked after save.`);
    await load();
  }

  const defaultFailoverList = useMemo(
    () =>
      (state?.providers ?? []).map((provider) => ({
        provider: provider.name,
        model: selectedModel[provider.name] || provider.models[0] || state?.currentModel || ""
      })),
    [selectedModel, state?.providers, state?.currentModel]
  );

  const effectiveFailoverList = failoverList.length > 0 ? failoverList : defaultFailoverList;

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Registry: Model Providers</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Configure model endpoint keys, monitor health metrics, and orchestrate automated failover boundaries.
          </div>
        </div>
        <div className="gc-badge" style={{ padding: "0.5rem 0.8rem" }}>
          {state?.providers.filter(p => p.available).length || 0} ACTIVE ENDPOINTS
        </div>
      </section>

      {!state ? (
        <div className="gc-card" style={{ padding: "4rem", textAlign: "center", color: "var(--gc-muted)" }}>
          Synchronizing with cloud orchestration layers...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.2rem" }}>
          {/* Left Column: Provider & Key Management */}
          <div style={{ display: "grid", gap: "1.2rem", alignContent: "start" }}>
            {/* API Key Vault */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--gc-primary)" }}>API Key Vault</h2>
                <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>AES-256 Masked Environment Storage</span>
              </div>
              <div style={{ display: "grid", gap: "0.8rem" }}>
                {KEY_ENTRIES.map((item) => (
                  <div key={item.env} className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.8rem", background: "rgba(255,255,255,0.01)" }}>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{item.title}</span>
                        <span style={{ color: "var(--gc-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                           {state.keys?.[item.provider]?.masked || "EMPTY_NULL"}
                        </span>
                     </div>
                     <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem" }}>
                        <input
                          type="password"
                          value={keyInputs[item.env]}
                          onChange={(e) => setKeyInputs(c => ({...c, [item.env]: e.target.value}))}
                          placeholder={`Enter ${item.title} Secret Key`}
                          style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", fontSize: "0.85rem", color: "inherit", outline: "none" }}
                        />
                        <button onClick={() => saveKey(item.env)} className="gc-button gc-button-primary" style={{ padding: "0.6rem 1rem" }}>
                           Encrypt & Save
                        </button>
                     </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Runtime Management */}
          <div style={{ display: "grid", gap: "1.2rem", alignContent: "start" }}>
            {/* Active Runtime Status */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Runtime Selection</h2>
                  <button 
                    onClick={toggleFailover} 
                    className={`gc-button ${state.failoverEnabled ? "gc-button-primary" : ""}`}
                    style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                  >
                    {state.failoverEnabled ? "Failover: ENABLED" : "Failover: DISABLED"}
                  </button>
               </div>

               <div style={{ display: "grid", gap: "0.75rem" }}>
                  {state.providers.map((provider) => {
                    const isActive = state.currentProvider === provider.name;
                    return (
                      <div 
                        key={provider.name}
                        style={{
                          border: "1px solid",
                          borderColor: isActive ? "var(--gc-primary)" : "var(--gc-border)",
                          borderRadius: "12px",
                          padding: "1rem",
                          background: isActive ? "rgba(0, 191, 165, 0.05)" : "rgba(255,255,255,0.01)",
                          display: "grid",
                          gap: "0.75rem",
                          transition: "all 200ms"
                        }}
                      >
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                               <strong style={{ fontSize: "0.9rem" }}>{provider.name}</strong>
                               {isActive && <span className="gc-badge" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>ACTIVE</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                               <span style={{ fontSize: "0.75rem", fontWeight: 600, color: provider.available ? "var(--gc-primary)" : "var(--gc-muted)" }}>
                                  {provider.health?.state?.toUpperCase() || (provider.available ? "READY" : "NO_KEY")}
                               </span>
                               <div className="gc-status-dot" style={{ background: provider.available ? "var(--gc-primary)" : "var(--gc-muted)" }}></div>
                            </div>
                         </div>

                         <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem" }}>
                            <select
                              value={selectedModel[provider.name] || provider.models[0] || ""}
                              onChange={(e) => setSelectedModel(c => ({...c, [provider.name]: e.target.value}))}
                              style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.5rem", background: "var(--gc-surface)", fontSize: "0.85rem", color: "inherit" }}
                            >
                              {(provider.models.length > 0 ? provider.models : [state.currentModel]).map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => switchProvider(provider.name, selectedModel[provider.name] || provider.models[0])}
                              className="gc-button"
                              style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", minWidth: "100px" }}
                            >
                              Activate
                            </button>
                         </div>

                         {provider.health?.lastError && (
                           <div style={{ padding: "0.6rem", background: "rgba(255, 94, 94, 0.05)", borderRadius: "6px", border: "1px solid var(--gc-danger-soft)", color: "var(--gc-danger)", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                              {provider.health.lastError}
                           </div>
                         )}
                      </div>
                    );
                  })}
               </div>
            </section>

            {/* Failover Priority Orchestration */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
               <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Failover Sequence</h2>
               <div style={{ display: "grid", gap: "0.4rem" }}>
                  {effectiveFailoverList.map((entry, index) => (
                    <div 
                      key={`${entry.provider}:${entry.model}:${index}`}
                      style={{
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        padding: "0.75rem 1rem", 
                        background: "var(--gc-bg-soft)", 
                        borderRadius: "10px", 
                        border: "1px solid var(--gc-border)"
                      }}
                    >
                       <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--gc-muted)", fontWeight: 700, width: "1.2rem" }}>{index + 1}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{entry.provider} / {entry.model}</span>
                       </div>
                       <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button 
                            onClick={() => persistFailoverList(move(effectiveFailoverList, index, -1))}
                            disabled={index === 0}
                            style={{ background: "none", border: "1px solid var(--gc-border)", borderRadius: "6px", padding: "2px 8px", color: "var(--gc-muted)", cursor: index === 0 ? "default" : "pointer" }}
                          >
                            ▲
                          </button>
                          <button 
                            onClick={() => persistFailoverList(move(effectiveFailoverList, index, 1))}
                            disabled={index === effectiveFailoverList.length - 1}
                            style={{ background: "none", border: "1px solid var(--gc-border)", borderRadius: "6px", padding: "2px 8px", color: "var(--gc-muted)", cursor: index === effectiveFailoverList.length - 1 ? "default" : "pointer" }}
                          >
                            ▼
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
               <button onClick={() => persistFailoverList(defaultFailoverList)} className="gc-button" style={{ fontSize: "0.75rem", padding: "0.4rem", color: "var(--gc-muted)" }}>
                  Reset to Natural Registry Order
               </button>
            </section>
          </div>
        </div>
      )}

      {status ? (
        <div style={{ position: "fixed", bottom: "2rem", right: "2rem", padding: "0.8rem 1.2rem", background: "var(--gc-surface)", border: "1px solid var(--gc-primary)", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", zIndex: 1000, color: "var(--gc-primary)", fontSize: "0.9rem" }}>
          {status}
          <button onClick={() => setStatus("")} style={{ marginLeft: "1rem", background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer" }}>✕</button>
        </div>
      ) : null}
    </div>
  );
}
