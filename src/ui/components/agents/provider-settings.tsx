"use client";

import { useEffect, useState } from "react";

interface ProviderState {
  providers: Array<{
    name: string;
    available: boolean;
    models: string[];
    health?: {
      state: "idle" | "ready" | "missing-key" | "error";
      lastAttemptAt?: string;
      lastSuccessAt?: string;
      lastError?: string;
    };
  }>;
  currentProvider: string;
  currentModel: string;
  failoverEnabled?: boolean;
}

async function fetchState() {
  return (await (await fetch("/api/providers")).json()) as ProviderState;
}

export function ProviderSettings() {
  const [state, setState] = useState<ProviderState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchState().then(setState);
  }, []);

  async function updateProvider(provider: string, model: string) {
    setBusy(true);
    await fetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, model })
    });
    setState(await fetchState());
    setBusy(false);
  }

  async function toggleFailover(enabled: boolean) {
    setBusy(true);
    await fetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failoverEnabled: enabled })
    });
    setState(await fetchState());
    setBusy(false);
  }

  if (!state) {
    return <div className="gc-card" style={{ padding: "1rem" }}>Loading provider settings...</div>;
  }

  return (
    <div className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Provider Selection</h2>
        <p style={{ color: "var(--gc-muted)", margin: 0 }}>Unified provider abstraction with optional failover routing.</p>
      </div>

      <div className="gc-card" style={{ padding: "0.65rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ fontSize: "0.9rem" }}>Failover</strong>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.75rem" }}>Retry other providers if selected provider fails.</div>
        </div>
        <button
          onClick={() => toggleFailover(!state.failoverEnabled)}
          disabled={busy}
          style={{
            border: "1px solid var(--gc-border)",
            borderRadius: "9px",
            background: state.failoverEnabled ? "rgba(25, 209, 195, 0.16)" : "transparent",
            padding: "0.4rem 0.55rem",
            cursor: "pointer"
          }}
        >
          {state.failoverEnabled ? "enabled" : "disabled"}
        </button>
      </div>

      <div style={{ display: "grid", gap: "0.65rem" }}>
        {state.providers.map((provider) => (
          <button
            key={provider.name}
            disabled={!provider.available || busy}
            onClick={() => updateProvider(provider.name, provider.models[0] ?? state.currentModel)}
            style={{
              textAlign: "left",
              border: "1px solid var(--gc-border)",
              borderRadius: "10px",
              background:
                state.currentProvider === provider.name ? "rgba(25, 209, 195, 0.16)" : "var(--gc-bg-soft)",
              padding: "0.6rem",
              cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{provider.name}</strong>
              <span style={{ color: provider.available ? "var(--gc-primary)" : "var(--gc-danger)", fontSize: "0.76rem" }}>
                {provider.health?.state ?? (provider.available ? "ready" : "missing key")}
              </span>
            </div>
            <div style={{ color: "var(--gc-muted)", fontSize: "0.76rem" }}>Default model: {provider.models[0] ?? "n/a"}</div>
            {provider.health?.lastError ? (
              <div style={{ color: "var(--gc-alert)", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                last error: {provider.health.lastError}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      <div style={{ marginTop: "0.1rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--gc-muted)" }}>
        active={state.currentProvider}/{state.currentModel} | failover={String(Boolean(state.failoverEnabled))}
      </div>
    </div>
  );
}
