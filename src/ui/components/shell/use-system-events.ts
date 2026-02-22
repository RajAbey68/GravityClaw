"use client";

import { useEffect, useMemo, useState } from "react";

export interface LiveEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export function useSystemEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/api/events/ws`);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (message) => {
      const payload = JSON.parse(message.data) as LiveEvent;
      setEvents((current) => [payload, ...current].slice(0, 200));
    };

    return () => socket.close();
  }, []);

  return useMemo(() => ({ events, connected }), [events, connected]);
}
