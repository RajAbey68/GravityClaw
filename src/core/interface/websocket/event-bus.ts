import { EventEmitter } from "node:events";
import type { SystemEvent } from "@/src/core/types";

export class SystemEventBus {
  private readonly emitter = new EventEmitter();
  private readonly history: SystemEvent[] = [];

  publish(event: SystemEvent) {
    this.history.unshift(event);
    if (this.history.length > 300) {
      this.history.pop();
    }
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: SystemEvent) => void) {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  recent(limit = 50) {
    return this.history.slice(0, limit);
  }
}
