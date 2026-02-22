"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useControlStore, LiveSystemEvent } from "@/src/ui/state/control-store";

export interface FeedEvent {
  id: string;
  workspaceId: string;
  hiveId?: string;
  eventType: string;
  actorId?: string;
  actorType?: string;
  content: string;
  metadata?: any;
  createdAt: number;
}

export function useLiveFeed(workspaceId = "default") {
  const { events: socketEvents, connected } = useControlStore();
  const [history, setHistory] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/feed?workspaceId=${workspaceId}&limit=100`);
      const data = await resp.json();
      if (data.events) {
        setHistory(data.events);
      }
    } catch (err) {
      console.error("Failed to fetch feed history:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const combinedFeed = useMemo(() => {
    // Map socket events to FeedEvent format if they aren't already
    const mappedSocketEvents: FeedEvent[] = socketEvents.map((ev, idx) => ({
      id: (ev as any).eventId || `socket-${idx}-${ev.timestamp}`,
      workspaceId: (ev as any).workspaceId || workspaceId,
      hiveId: (ev as any).hiveId,
      eventType: ev.type,
      actorId: (ev as any).agentId || (ev as any).actorId,
      actorType: (ev as any).actorType || ((ev as any).agentId ? "agent" : "system"),
      content: (ev as any).content || `${ev.type} triggered`,
      metadata: ev,
      createdAt: new Date(ev.timestamp).getTime()
    }));

    // Merge and deduplicate by ID
    const all = [...mappedSocketEvents, ...history];
    const seen = new Set();
    return all
      .filter((ev) => {
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [socketEvents, history, workspaceId]);

  return {
    feed: combinedFeed,
    connected,
    loading,
    refresh: fetchHistory
  };
}
