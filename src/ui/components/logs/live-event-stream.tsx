"use client";

import type { LiveEvent } from "@/src/ui/components/shell/use-system-events";

export function LiveEventStream({ events, connected }: { events: LiveEvent[]; connected: boolean }) {
  return (
    <div className="gc-card" style={{ padding: "0.8rem", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <strong>Event Stream</strong>
        <span className="gc-badge">{connected ? "ws:connected" : "ws:offline"}</span>
      </div>
      <div className="gc-scroll" style={{ display: "grid", gap: "0.5rem", maxHeight: "62vh", overflowY: "auto" }}>
        {events.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem" }}>No events yet.</div>
        ) : (
          events.map((event, idx) => (
            <div
              key={`${event.timestamp}-${idx}`}
              style={{
                border: "1px solid var(--gc-border)",
                borderRadius: "10px",
                padding: "0.5rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.73rem"
              }}
            >
              <div style={{ color: "var(--gc-primary)", marginBottom: "0.2rem" }}>{event.type}</div>
              <div style={{ color: "var(--gc-muted)" }}>{event.timestamp}</div>
              <div style={{ marginTop: "0.2rem", color: "var(--gc-muted)" }}>
                {JSON.stringify(event)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
