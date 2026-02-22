"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/src/ui/components/common/action-button";

type SoulKey =
  | "persona"
  | "behavioral constraints"
  | "ethical boundaries"
  | "communication style"
  | "delegation rules"
  | "proactivity rules"
  | "sub-agent spawning policies";

const soulKeys: SoulKey[] = [
  "persona",
  "behavioral constraints",
  "ethical boundaries",
  "communication style",
  "delegation rules",
  "proactivity rules",
  "sub-agent spawning policies"
];

export function ProfilesPage() {
  const [sections, setSections] = useState<Record<SoulKey, string>>({
    persona: "",
    "behavioral constraints": "",
    "ethical boundaries": "",
    "communication style": "",
    "delegation rules": "",
    "proactivity rules": "",
    "sub-agent spawning policies": ""
  });
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/profiles", { cache: "no-store" });
    const payload = (await response.json()) as {
      sections?: Record<SoulKey, string>;
      raw?: string;
    };
    if (payload.sections) {
      setSections(payload.sections);
    }
    if (payload.raw) {
      setRaw(payload.raw);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sections })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update profile.");
    }
    setStatus("SOUL profile updated.");
    await load();
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header Section */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Constitutional Calibration: SOUL Profile</h1>
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Mould the core behavioral logic, ethical constraints, and communication personality of your agent collective.
          </div>
        </div>
        <button onClick={saveProfile} className="gc-button gc-button-primary" style={{ padding: "0.6rem 1.2rem" }}>
           Update Soul Constitution
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.2rem", alignItems: "start" }}>
        {/* Editor Column */}
        <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
          <div>
             <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--gc-primary)" }}>Fragment Calibration</h2>
             <p style={{ color: "var(--gc-muted)", fontSize: "0.8rem", margin: "0.4rem 0 0 0" }}>Update specific architectural sectors of the agent's core directive.</p>
          </div>

          <div style={{ display: "grid", gap: "1.2rem" }}>
            {soulKeys.map((key) => (
              <div key={key} style={{ display: "grid", gap: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{key}</span>
                   <span className="gc-badge" style={{ fontSize: "0.6rem", padding: "1px 6px" }}>FRAGMENT: {key.split(' ')[0].toUpperCase()}</span>
                </div>
                <textarea
                  value={sections[key]}
                  onChange={(event) =>
                    setSections((current) => ({
                      ...current,
                      [key]: event.target.value
                    }))
                  }
                  placeholder={`Define the ${key} logic...`}
                  style={{
                    minHeight: "100px",
                    border: "1px solid var(--gc-border)",
                    borderRadius: "10px",
                    padding: "0.8rem",
                    background: "var(--gc-surface)",
                    color: "inherit",
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                    outline: "none",
                    resize: "vertical",
                    transition: "border-color 200ms"
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Preview Column */}
        <div style={{ display: "grid", gap: "1.2rem", position: "sticky", top: "72px" }}>
           <section className="gc-card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                 <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Constitutional Preview</h2>
                 <span style={{ color: "var(--gc-muted)", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>LIVE_BYTE_STREAM</span>
              </div>
              <textarea
                readOnly
                value={raw}
                style={{
                  minHeight: "calc(100vh - 350px)",
                  width: "100%",
                  border: "1px solid var(--gc-border)",
                  borderRadius: "10px",
                  padding: "1rem",
                  background: "rgba(0,0,0,0.2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8rem",
                  color: "var(--gc-primary)",
                  lineHeight: "1.5",
                  outline: "none",
                  resize: "none"
                }}
              />
           </section>

           <div className="gc-card" style={{ padding: "1rem", background: "rgba(25, 209, 195, 0.03)", border: "1px solid var(--gc-primary-soft)" }}>
              <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                 <div style={{ color: "var(--gc-primary)" }}>ℹ️</div>
                 <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }}>
                    These directive fragments are injected into the system prompt of every agent in the current collective.
                 </div>
              </div>
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

