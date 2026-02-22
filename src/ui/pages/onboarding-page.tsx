"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/src/ui/components/common/action-button";
import { useControlStore } from "@/src/ui/state/control-store";
import type { ProviderId } from "@/src/core/providers/types";

type ProviderKey =
  | "OPENAI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "GEMINI_API_KEY"
  | "XAI_API_KEY"
  | "DEEPSEEK_API_KEY"
  | "GROQ_API_KEY"
  | "OPENROUTER_API_KEY";
type ProviderName = ProviderId;

interface OnboardingState {
  workspaceId: string;
  workspaceName: string;
  completedAt?: string;
  goal: string;
  providerCurrent: {
    provider: ProviderName;
    model: string;
    failoverEnabled: boolean;
  };
  providerKeys: Record<ProviderName, { configured: boolean; masked: string }>;
  subAgents: Array<{ id: string; label: string }>;
  steps: Array<{
    id: string;
    title: string;
    question: string;
    done: boolean;
    optional?: boolean;
  }>;
  progress: {
    done: number;
    total: number;
    percent: number;
    withOptionalDone: number;
  };
  nextPrompt: string;
}

const keyOptions: Array<{ key: ProviderKey; label: string }> = [
  { key: "OPENAI_API_KEY", label: "OpenAI" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { key: "GEMINI_API_KEY", label: "Gemini" },
  { key: "XAI_API_KEY", label: "xAI / Grok" },
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek" },
  { key: "GROQ_API_KEY", label: "Groq" },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter" }
];

const providerOptions: ProviderName[] = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
  "deepseek",
  "groq",
  "openrouter",
  "ollama"
];

function stepStatus(step: OnboardingState["steps"][number]) {
  if (step.done) return "done";
  if (step.optional) return "optional";
  return "pending";
}

export function OnboardingPage() {
  const { workspaceId } = useControlStore();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [providerKey, setProviderKey] = useState<ProviderKey>("OPENAI_API_KEY");
  const [providerKeyValue, setProviderKeyValue] = useState("");
  const [defaultProvider, setDefaultProvider] = useState<ProviderName>("openai");
  const [defaultModel, setDefaultModel] = useState("");
  const [goal, setGoal] = useState("");
  const [subAgentLabel, setSubAgentLabel] = useState("Worker Agent");

  const load = useCallback(async () => {
    const response = await fetch(`/api/onboarding?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as OnboardingState;
    setState(payload);
    setGoal(payload.goal ?? "");
    setDefaultProvider(payload.providerCurrent.provider);
    setDefaultModel(payload.providerCurrent.model ?? "");
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action: Record<string, unknown>) {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, ...action })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Onboarding action failed.");
    }
    await load();
  }

  async function saveProviderKeyAction() {
    const value = providerKeyValue.trim();
    if (!value) {
      setStatus("Enter an API key value before saving.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/providers/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerKey, value })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save provider key.");
      }
      setProviderKeyValue("");
      setStatus(`${providerKey} saved and masked.`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function applyDefaultProviderAction() {
    await runAction({
      action: "set-provider-default",
      provider: defaultProvider,
      model: defaultModel || undefined
    });
    setStatus(`Default provider set to ${defaultProvider}${defaultModel ? `/${defaultModel}` : ""}.`);
  }

  async function saveGoalAction() {
    if (!goal.trim()) {
      setStatus("Enter a workspace goal first.");
      return;
    }
    await runAction({ action: "set-workspace-goal", goal: goal.trim() });
    setStatus("Workspace objective saved.");
  }

  async function createSubAgentAction() {
    await runAction({ action: "create-sub-agent", label: subAgentLabel.trim() || "Worker Agent" });
    setStatus("Sub-agent created.");
  }

  async function applySecurityBaselineAction() {
    await runAction({ action: "apply-security-baseline" });
    setStatus("Security baseline applied.");
  }

  async function completeOnboardingAction() {
    await runAction({ action: "complete-onboarding" });
    setStatus("Onboarding completed for this workspace.");
  }

  const pendingRequired = useMemo(
    () => (state?.steps ?? []).filter((step) => !step.optional && !step.done),
    [state]
  );

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Interactive Workspace Initialization</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Initialize provider orchestration, security baselines, and goal alignment for <span className="gc-badge" style={{ fontSize: "0.7rem", verticalAlign: "middle" }}>{workspaceId}</span>
          </div>
        </div>
      </section>

      {!state ? (
        <section className="gc-card" style={{ padding: "3rem", textAlign: "center", color: "var(--gc-muted)" }}>
           Decrypting initialization sequence...
        </section>
      ) : (
        <>
          {/* Progress & Directive */}
          <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{state.workspaceName} Orientation</h2>
                  <div style={{ fontSize: "0.8rem", color: "var(--gc-muted)", marginTop: "0.2rem" }}>
                    {state.progress.done} of {state.progress.total} critical milestones achieved.
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                   <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--gc-primary)" }}>{state.progress.percent}%</div>
                   <div style={{ fontSize: "0.6rem", color: "var(--gc-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>INITIALIZATION</div>
                </div>
             </div>
             
             <div style={{ height: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--gc-border)" }}>
                <div style={{ width: `${state.progress.percent}%`, height: "100%", background: "var(--gc-primary)", boxShadow: "0 0 15px var(--gc-primary-soft)", transition: "width 500ms ease-out" }} />
             </div>

             <div className="gc-card" style={{ padding: "1.2rem", background: "rgba(25, 209, 195, 0.03)", border: "1px solid var(--gc-primary-soft)", display: "flex", gap: "1rem", alignItems: "start" }}>
                <div style={{ fontSize: "1.2rem" }}>🤖</div>
                <div>
                   <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gc-primary)", marginBottom: "0.3rem" }}>ONBOARDING ASSISTANT</div>
                   <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.9)", lineHeight: "1.5" }}>{state.nextPrompt}</div>
                </div>
             </div>
          </section>

          {/* Setup Tiers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
            
            {/* Step 1: Identity */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
               <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--gc-primary)" }}>1. PROVIDER ORCHESTRATION</h3>
               <div style={{ display: "grid", gap: "1rem" }}>
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>SELECT PROVIDER</span>
                    <select
                      value={providerKey}
                      onChange={(e) => setProviderKey(e.target.value as ProviderKey)}
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none" }}
                    >
                      {keyOptions.map((entry) => (
                        <option key={entry.key} value={entry.key}>{entry.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>API AUTHENTICATION TOKEN</span>
                    <input
                      type="password"
                      value={providerKeyValue}
                      onChange={(e) => setProviderKeyValue(e.target.value)}
                      placeholder="Enter secret key..."
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none" }}
                    />
                  </div>
                  <button
                    onClick={saveProviderKeyAction}
                    disabled={saving}
                    className="gc-button gc-button-primary"
                    style={{ padding: "0.6rem" }}
                  >
                    {saving ? "CRYPTOGRAPHIC_SAVE..." : "SAVE KEY TO VAULT"}
                  </button>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginTop: "0.5rem" }}>
                     {providerOptions.map(p => (
                        <div key={p} style={{ fontSize: "0.6rem", display: "flex", justifyContent: "space-between", color: "var(--gc-muted)", borderBottom: "1px solid rgba(255,255,255,0.03)", padding: "2px 0" }}>
                           <span style={{ textTransform: "uppercase" }}>{p}</span>
                           <span style={{ color: state.providerKeys[p]?.configured ? "var(--gc-primary)" : "var(--gc-muted)" }}>
                              {state.providerKeys[p]?.configured ? "CONFIGURED" : "PENDING"}
                           </span>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Step 2: Defaults */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
               <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--gc-primary)" }}>2. RUNTIME DEFAULTS</h3>
               <div style={{ display: "grid", gap: "1rem" }}>
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>PRIMARY LLM PROVIDER</span>
                    <select
                      value={defaultProvider}
                      onChange={(e) => setDefaultProvider(e.target.value as ProviderName)}
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none" }}
                    >
                      {providerOptions.map((provider) => (
                        <option key={provider} value={provider}>{provider.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>MODEL OVERRIDE (OPTIONAL)</span>
                    <input
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      placeholder="e.g. gpt-4o, claude-3-opus"
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none" }}
                    />
                  </div>
                  <button onClick={applyDefaultProviderAction} className="gc-button" style={{ padding: "0.6rem" }}>APPLY RUNTIME DEFAULT</button>
               </div>

               <div style={{ marginTop: "auto", display: "grid", gap: "1rem", borderTop: "1px solid var(--gc-border)", paddingTop: "1.2rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--gc-primary)" }}>3. STRATEGIC OBJECTIVE</h3>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Define the primary mission of this workspace..."
                    style={{ minHeight: "80px", border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.8rem", background: "var(--gc-surface)", color: "inherit", outline: "none", fontSize: "0.85rem", resize: "none" }}
                  />
                  <button onClick={saveGoalAction} className="gc-button" style={{ padding: "0.6rem" }}>SAVE WORKSPACE GOAL</button>
               </div>
            </section>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.2rem" }}>
            {/* Step 4: First Agent */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
               <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--gc-primary)" }}>4. INITIAL SUB-AGENT</h3>
               <div style={{ display: "grid", gap: "1rem" }}>
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--gc-muted)", fontWeight: 700 }}>AGENT LABEL</span>
                    <input
                      value={subAgentLabel}
                      onChange={(e) => setSubAgentLabel(e.target.value)}
                      placeholder="Worker Agent"
                      style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.6rem", background: "var(--gc-surface)", color: "inherit", outline: "none" }}
                    />
                  </div>
                  <button onClick={createSubAgentAction} className="gc-button" style={{ padding: "0.6rem" }}>SPAWN SUB-AGENT</button>
                  <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>
                     Active Roster: {state.subAgents.length === 0 ? "Empty" : state.subAgents.map(a => a.id).join(", ")}
                  </div>
               </div>
            </section>

            {/* Checklist */}
            <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.2rem" }}>
               <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>INITIALIZATION MILESTONES</h3>
               <div style={{ display: "grid", gap: "0.6rem" }}>
                 {state.steps.map((step) => (
                   <div key={step.id} style={{ display: "flex", gap: "0.8rem", alignItems: "start", opacity: step.done ? 0.6 : 1 }}>
                      <div style={{ 
                        marginTop: "2px",
                        width: "14px", 
                        height: "14px", 
                        borderRadius: "3px", 
                        border: `1.5px solid ${step.done ? "var(--gc-primary)" : "var(--gc-border)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: step.done ? "var(--gc-primary)" : "transparent",
                        color: "white",
                        fontSize: "9px"
                      }}>
                        {step.done ? "✓" : ""}
                      </div>
                      <div>
                         <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{step.title}</div>
                         <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)" }}>{step.question}</div>
                      </div>
                   </div>
                 ))}
               </div>
            </section>
          </div>

          {/* Final Actions */}
          <section className="gc-card" style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.8rem" }}>
               <button onClick={applySecurityBaselineAction} className="gc-button" style={{ padding: "0.6rem 1.2rem" }}>Harden Workspace</button>
               <button onClick={completeOnboardingAction} className={`gc-button ${pendingRequired.length === 0 ? "gc-button-primary" : ""}`} style={{ padding: "0.6rem 1.2rem" }}>Finish Initial Setup</button>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
               <span style={{ fontSize: "0.75rem", color: pendingRequired.length === 0 ? "var(--gc-primary)" : "var(--gc-danger)" }}>
                  {pendingRequired.length === 0 ? "✓ READY FOR DEPLOYMENT" : `⚠ ${pendingRequired.length} REQUIRED STEPS PENDING`}
               </span>
               <Link href="/settings" className="gc-button" style={{ padding: "0.6rem 1.2rem", textDecoration: "none" }}>Advanced Config</Link>
            </div>
          </section>
        </>
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
