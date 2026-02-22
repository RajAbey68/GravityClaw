import type { SystemEvent } from "@/src/core/types";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

let eventSeq = 0;

function nextEventId() {
  eventSeq += 1;
  return `evt-${Date.now()}-${eventSeq}`;
}

export function publishEvent(
  bus: SystemEventBus,
  event: Omit<SystemEvent, "timestamp"> | Record<string, unknown>
) {
  bus.publish({
    ...event,
    eventId: typeof (event as { eventId?: unknown }).eventId === "string"
      ? (event as { eventId: string }).eventId
      : nextEventId(),
    timestamp: new Date().toISOString()
  } as SystemEvent);
}
