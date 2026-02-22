"use client";

import { useSystemEvents } from "@/src/ui/components/shell/use-system-events";

export function EventTable() {
  const { events } = useSystemEvents();

  return (
    <div className="gc-card" style={{ padding: "0.9rem" }}>
      <strong>Execution Events</strong>
      <div className="gc-scroll" style={{ marginTop: "0.6rem", maxHeight: "38vh", overflowY: "auto", display: "grid", gap: "0.45rem" }}>
        {events.map((event, index) => (
          <div
            key={`${event.timestamp}-${index}`}
            style={{ border: "1px solid var(--gc-border)", borderRadius: "9px", padding: "0.45rem" }}
          >
            <div style={{ color: "var(--gc-primary)", fontSize: "0.75rem" }}>{event.type}</div>
            <div style={{ color: "var(--gc-muted)", fontSize: "0.72rem" }}>{event.timestamp}</div>
            <div style={{ color: "var(--gc-muted)", fontSize: "0.7rem", marginTop: "0.2rem" }}>
              {JSON.stringify(event)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
