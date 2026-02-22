"use client";

import { LiveEventStream } from "@/src/ui/components/logs/live-event-stream";
import { useSystemEvents } from "@/src/ui/components/shell/use-system-events";

export function ObservabilityRail() {
  const { events, connected } = useSystemEvents();
  return <LiveEventStream events={events} connected={connected} />;
}
