"use client";

import { useLiveFeed, FeedEvent } from "@/src/ui/hooks/use-live-feed";
import { useControlStore } from "@/src/ui/state/control-store";
import { useMemo } from "react";

interface LiveFeedProps {
  hiveId?: string;
  workspaceId?: string;
  maxHeight?: string;
}

export function LiveFeed({ hiveId, workspaceId = "default", maxHeight = "60vh" }: LiveFeedProps) {
  const { feed, connected, loading } = useLiveFeed(workspaceId);
  const filteredFeed = useMemo(() => {
    return hiveId ? feed.filter((e) => e.hiveId === hiveId) : feed;
  }, [feed, hiveId]);

  return (
    <div 
      className="gc-card" 
      style={{ 
        padding: "1rem", 
        height: "100%", 
        display: "flex", 
        flexDirection: "column",
        background: "rgba(10, 20, 30, 0.4)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        overflow: "hidden"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ 
            width: "8px", 
            height: "8px", 
            borderRadius: "50%", 
            background: connected ? "var(--gc-primary)" : "var(--gc-muted)",
            boxShadow: connected ? "0 0 10px var(--gc-primary)" : "none"
          }} />
          <strong style={{ fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Live Activity Feed
          </strong>
        </div>
        <span className="gc-badge" style={{ fontSize: "0.65rem", opacity: 0.8 }}>
          {filteredFeed.length} EVENTS
        </span>
      </div>

      <div 
        className="gc-scroll" 
        style={{ 
          flex: 1, 
          maxHeight, 
          overflowY: "auto", 
          display: "grid", 
          gap: "0.8rem",
          paddingRight: "4px"
        }}
      >
        {loading && filteredFeed.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", padding: "1rem", textAlign: "center" }}>
            Synchronizing stream...
          </div>
        ) : filteredFeed.length === 0 ? (
          <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", padding: "1rem", textAlign: "center" }}>
            No activity recorded.
          </div>
        ) : (
          filteredFeed.map((event) => (
            <FeedItem key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

function FeedItem({ event }: { event: FeedEvent }) {
  const color = useMemo(() => {
    if (event.eventType.includes("error")) return "var(--gc-danger)";
    if (event.eventType.includes("tool")) return "var(--gc-primary)";
    if (event.eventType.includes("hive")) return "#a855f7"; // purple
    if (event.eventType.includes("mesh")) return "#22d3ee"; // cyan
    if (event.eventType.includes("heartbeat")) return "var(--gc-primary)";
    if (event.eventType.includes("recommendation")) return "#fbbf24"; // amber
    if (event.eventType.includes("swarm")) return "#06b6d4"; // cyan
    return "var(--gc-muted)";
  }, [event.eventType]);

  return (
    <div 
      style={{ 
        padding: "0.8rem", 
        background: "rgba(255, 255, 255, 0.02)", 
        border: "1px solid rgba(255, 255, 255, 0.05)",
        borderRadius: "8px",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s ease"
      }}
    >
      <div 
        style={{ 
          position: "absolute", 
          top: 0, 
          left: 0, 
          width: "2px", 
          height: "100%", 
          background: color 
        }} 
      />
      
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
        <span style={{ 
          fontSize: "0.65rem", 
          fontWeight: 700, 
          textTransform: "uppercase", 
          color: color,
          letterSpacing: "0.03em"
        }}>
          {event.eventType.replace(/\./g, " ")}
        </span>
        <span style={{ fontSize: "0.6rem", color: "var(--gc-muted)" }}>
          {new Date(event.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <div style={{ 
        fontSize: "0.8rem", 
        color: "rgba(255,255,255,0.9)", 
        lineHeight: "1.4",
        marginBottom: "0.4rem"
      }}>
        {event.content}
      </div>

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
        {event.actorId && (
          <div style={{ 
            fontSize: "0.65rem", 
            color: "var(--gc-muted)", 
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem"
          }}>
            <span style={{ color: color }}>●</span> {event.actorId}
          </div>
        )}
        {event.hiveId && (
          <div className="gc-badge" style={{ fontSize: "0.6rem", height: "1.2rem", padding: "0 0.4rem" }}>
            HIVE: {event.hiveId.slice(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
}
