"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useControlStore } from "@/src/ui/state/control-store";

interface CanvasPayload {
  hierarchy: Array<{ id: string; parentId: string | null; type: string; status: string }>;
  rooms: Array<{ id: string; mode: string; coordinator_id: string; round_limit: number; status: string }>;
  forgeJobs: Array<{ id: string; stage: string; status: string; capability: string; agentId: string }>;
  calls: Array<{ id: string; state: string; controllingAgentId: string; toNumber: string }>;
  delegations: Array<{ id: string; parent_agent_id: string; target_agent_id: string; objective: string; status: string }>;
  usage: {
    provider: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; requests: number };
    toolUsage: Array<{ tool_id: string; total: number }>;
  };
  runningLoops: number;
  memoryReadEvents: number;
  recentEvents: Array<{ type: string; timestamp: string; [key: string]: unknown }>;
  recentRoomMessages: Array<{ id: number; from_agent_id: string; to_agent_id: string; role: string; content: string; created_at: string; round: number }>;
}

interface LiveEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

// D3 Node/Link Types
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  status: string;
}
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: "hierarchy" | "delegation";
}

function Gauge({ label, value, max, unit = "" }: { label: string; value: number; max: number; unit?: string }) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="gc-card" style={{ padding: "1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", textAlign: "center" }}>
      <div style={{ position: "relative", width: "80px", height: "80px" }}>
        <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke="var(--gc-primary)" strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{value > 999 ? (value / 1000).toFixed(1) + "k" : value}</span>
          <span style={{ fontSize: "0.6rem", color: "var(--gc-muted)", textTransform: "uppercase" }}>{unit}</span>
        </div>
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

export function CanvasPage() {
  const { workspaceId, events } = useControlStore();
  const [canvas, setCanvas] = useState<CanvasPayload | null>(null);
  const [scrubber, setScrubber] = useState(0);
  const [lastAppliedEventId, setLastAppliedEventId] = useState("");
  const gRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const pushRecentEvent = useCallback((current: CanvasPayload, event: LiveEvent) => {
    const merged = [event, ...current.recentEvents].slice(0, 120);
    return { ...current, recentEvents: merged };
  }, []);

  const applyEvent = useCallback((current: CanvasPayload, event: LiveEvent): CanvasPayload => {
    const next = pushRecentEvent(current, event);
    switch (event.type) {
      case "agent.spawned": {
        const agentId = String(event.agentId ?? "");
        if (!agentId || next.hierarchy.some((node) => node.id === agentId)) return next;
        return {
          ...next,
          hierarchy: [{ id: agentId, parentId: typeof event.parentId === "string" ? event.parentId : null, type: "sub-agent", status: "idle" }, ...next.hierarchy]
        };
      }
      case "agent.status.changed": {
        const agentId = String(event.agentId ?? "");
        const status = String(event.status ?? "idle");
        const hierarchy = next.hierarchy.map((node) => node.id === agentId ? { ...node, status } : node);
        return { ...next, hierarchy, runningLoops: hierarchy.filter((node) => node.status === "busy").length };
      }
      case "tool.called": {
        const toolId = String(event.toolId ?? "");
        if (!toolId) return next;
        const existing = next.usage.toolUsage.find((row) => row.tool_id === toolId);
        const toolUsage = existing
          ? next.usage.toolUsage.map((row) => row.tool_id === toolId ? { ...row, total: row.total + 1 } : row)
          : [{ tool_id: toolId, total: 1 }, ...next.usage.toolUsage];
        return { ...next, usage: { ...next.usage, toolUsage } };
      }
      case "provider.usage.updated": {
        return {
          ...next,
          usage: {
            ...next.usage,
            provider: {
              ...next.usage.provider,
              inputTokens: next.usage.provider.inputTokens + Number(event.inputTokens ?? 0),
              outputTokens: next.usage.provider.outputTokens + Number(event.outputTokens ?? 0),
              estimatedCostUsd: Number((next.usage.provider.estimatedCostUsd + Number(event.estimatedCostUsd ?? 0)).toFixed(6)),
              requests: next.usage.provider.requests + 1
            }
          }
        };
      }
      case "memory.read": {
        return { ...next, memoryReadEvents: next.memoryReadEvents + Number(event.count ?? 0) };
      }
      case "delegation.created": {
        const id = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return {
          ...next,
          delegations: [{ id, parent_agent_id: String(event.fromAgentId ?? "main"), target_agent_id: String(event.toAgentId ?? "unknown"), objective: String(event.objective ?? ""), status: "running" }, ...next.delegations].slice(0, 60)
        };
      }
      case "delegation.completed": {
        const fromAgentId = String(event.fromAgentId ?? "");
        const toAgentId = String(event.toAgentId ?? "");
        return {
          ...next,
          delegations: next.delegations.map((delegation) => delegation.parent_agent_id === fromAgentId && delegation.target_agent_id === toAgentId ? { ...delegation, status: String(event.status ?? "completed") } : delegation)
        };
      }
      case "hive.broadcast": {
        const hiveId = String(event.hiveId ?? "");
        const message = String(event.message ?? "");
        // We can visual this as a special pulse on all swarm members in that hive
        // For simplicity, we just add it to history
        return next;
      }
      case "hive.agent.added": {
        // Refresh hierarchy if agent was added to a hive
        // In a real app we might want to group them visually
        return next;
      }
      default: return next;
    }
  }, [pushRecentEvent]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/canvas/state?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = (await response.json()) as CanvasPayload;
    setCanvas(payload);
    setScrubber((prev) => Math.min(prev, Math.max(0, payload.recentEvents.length - 1)));
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const latest = events[0] as LiveEvent | undefined;
    if (!latest) return;
    const latestId = typeof latest.eventId === "string" ? latest.eventId : `${latest.type}:${latest.timestamp}`;
    if (latestId === lastAppliedEventId) return;
    setLastAppliedEventId(latestId);
    setCanvas((current) => (current ? applyEvent(current, latest) : current));
  }, [events, applyEvent, lastAppliedEventId]);

  // D3 Implementation
  useEffect(() => {
    if (!gRef.current || !canvas) return;

    const width = 800;
    const height = 400;
    const svg = d3.select(gRef.current);
    svg.selectAll("*").remove();

    const nodes: GraphNode[] = canvas.hierarchy.map(n => ({ id: n.id, type: n.type, status: n.status }));
    const links: GraphLink[] = [];

    // Hierarchy links
    canvas.hierarchy.forEach(n => {
      if (n.parentId && nodes.some(m => m.id === n.parentId)) {
        links.push({ id: `h-${n.id}`, source: n.parentId, target: n.id, type: "hierarchy" });
      }
    });

    // Delegation links
    canvas.delegations.forEach(d => {
      if (nodes.some(n => n.id === d.parent_agent_id) && nodes.some(n => n.id === d.target_agent_id)) {
        links.push({ id: `d-${d.id}`, source: d.parent_agent_id, target: d.target_agent_id, type: "delegation" });
      }
    });

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    simulationRef.current = simulation;

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.type === "hierarchy" ? "rgba(25, 209, 195, 0.3)" : "rgba(255, 171, 0, 0.4)")
      .attr("stroke-dasharray", d => d.type === "delegation" ? "4,4" : "none")
      .attr("stroke-width", 2);

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (e, d) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }) as any);

    node.append("circle")
      .attr("r", 25)
      .attr("fill", "rgba(10, 20, 25, 0.8)")
      .attr("stroke", d => d.status === "busy" ? "var(--gc-primary)" : "var(--gc-border)")
      .attr("stroke-width", 2)
      .style("filter", d => d.status === "busy" ? "drop-shadow(0 0 8px var(--gc-primary))" : "none");

    node.append("text")
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .style("pointer-events", "none")
      .text(d => d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [canvas]);

  const timeline = canvas?.recentEvents ?? [];
  const selectedTimelineEvent = timeline[scrubber] ?? null;

  const browserEvents = timeline.filter((event) => {
    const serialized = JSON.stringify(event).toLowerCase();
    return serialized.includes("browser") || serialized.includes("navigate") || serialized.includes("dom");
  });

  const shellEvents = timeline.filter((event) => {
    const serialized = JSON.stringify(event).toLowerCase();
    return serialized.includes("shell") || serialized.includes("stdout") || serialized.includes("stderr");
  });

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Header */}
      <section className="gc-card" style={{ padding: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
           <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Execution Canvas</h1>
            <span className="gc-badge" style={{ animation: "pulse 2s infinite" }}>LIVE_SYSTEM_FEED</span>
          </div>
          <p style={{ color: "var(--gc-muted)", fontSize: "0.85rem", margin: "0.4rem 0 0 0" }}>
            High-fidelity observability terminal visualizing agent swarm dynamics and resource orchestration.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
           <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)", textTransform: "uppercase" }}>Uptime</div>
              <div style={{ fontSize: "1rem", fontWeight: 600 }}>04:12:33</div>
           </div>
        </div>
      </section>

      {!canvas ? (
        <section className="gc-card" style={{ padding: "3rem", textAlign: "center" }}>Initializing observability engine...</section>
      ) : (
        <>
          {/* Resource Gauges */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.2rem" }}>
            <Gauge label="Token Velocity" value={canvas.usage.provider.inputTokens + canvas.usage.provider.outputTokens} max={100000} unit="tokens" />
            <Gauge label="Budget Burn" value={Math.round(canvas.usage.provider.estimatedCostUsd * 100)} max={500} unit="cents" />
            <Gauge label="Memory Recalls" value={canvas.memoryReadEvents} max={500} unit="events" />
            <div className="gc-card" style={{ padding: "1.2rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
               <div style={{ fontSize: "0.8rem", color: "var(--gc-muted)", marginBottom: "0.4rem" }}>Orchestration Load</div>
               <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--gc-primary)" }}>{canvas.runningLoops} <span style={{ fontSize: "0.9rem", color: "var(--gc-muted)", fontWeight: 400 }}>ACTIVE LOOPS</span></div>
               <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", marginTop: "0.8rem", overflow: "hidden" }}>
                  <div style={{ width: `${(canvas.runningLoops / 10) * 100}%`, height: "100%", background: "var(--gc-primary)", transition: "width 0.5s ease" }} />
               </div>
            </div>
          </section>

          {/* Force Graph & Execution Heatmap */}
          <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.2rem" }}>
            <div className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Swarm Topology</h2>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <span className="gc-badge" style={{ background: "rgba(25, 209, 195, 0.1)", color: "var(--gc-primary)" }}>● HIERARCHY</span>
                  <span className="gc-badge" style={{ background: "rgba(255, 171, 0, 0.1)", color: "#ffab00" }}>● DELEGATION</span>
                </div>
              </div>
              <div style={{ border: "1px solid var(--gc-border)", borderRadius: "12px", background: "rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
                <svg ref={gRef} width="100%" height="400" preserveAspectRatio="xMidYMid meet" />
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
               <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Tool pressure</h2>
               <div className="gc-scroll" style={{ display: "grid", gap: "0.6rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {canvas.usage.toolUsage.length === 0 ? (
                    <div style={{ color: "var(--gc-muted)", fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>No tools executed.</div>
                  ) : (
                    [...canvas.usage.toolUsage].sort((a,b) => b.total - a.total).map((row) => (
                      <div key={row.tool_id} style={{ 
                        padding: "0.8rem 1rem", 
                        borderRadius: "10px", 
                        background: "rgba(255,255,255,0.03)", 
                        border: "1px solid var(--gc-border)",
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                           <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--gc-primary)" }} />
                           <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{row.tool_id}</span>
                        </div>
                        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{row.total}</span>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </section>

          {/* Domain Visualizers */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.2rem" }}>
            <div className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--gc-primary)" }}>Browser Automation</h3>
              <div className="gc-scroll" style={{ height: "200px", overflowY: "auto", display: "grid", gap: "0.5rem", paddingRight: "0.4rem" }}>
                {browserEvents.length === 0 ? (
                   <div style={{ color: "var(--gc-muted)", fontSize: "0.75rem", textAlign: "center", padding: "1rem" }}>Awaiting browser activity...</div>
                ) : (
                  browserEvents.map((e, i) => (
                    <div key={i} style={{ padding: "0.6rem", background: "rgba(0,0,0,0.2)", borderRadius: "6px", border: "1px solid var(--gc-border)", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                       <span style={{ color: "var(--gc-primary)" }}>{String(e.type).split(".").pop()}</span> :: {JSON.stringify(e).slice(0, 100)}...
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--gc-primary)" }}>Shell Execution</h3>
              <div className="gc-scroll" style={{ height: "200px", overflowY: "auto", display: "grid", gap: "0.5rem", paddingRight: "0.4rem" }}>
                 {shellEvents.length === 0 ? (
                   <div style={{ color: "var(--gc-muted)", fontSize: "0.75rem", textAlign: "center", padding: "1rem" }}>Awaiting shell activity...</div>
                ) : (
                  shellEvents.map((e, i) => (
                    <div key={i} style={{ padding: "0.6rem", background: "rgba(0,0,0,0.2)", borderRadius: "6px", border: "1px solid var(--gc-border)", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                       <span style={{ color: "var(--gc-primary)" }}>{String(e.type).split(".").pop()}</span> :: {JSON.stringify(e).slice(0, 100)}...
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="gc-card" style={{ padding: "1.2rem", display: "grid", gap: "0.8rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--gc-primary)" }}>Delegation Chain</h3>
              <div className="gc-scroll" style={{ height: "200px", overflowY: "auto", display: "grid", gap: "0.5rem", paddingRight: "0.4rem" }}>
                 {canvas.delegations.length === 0 ? (
                   <div style={{ color: "var(--gc-muted)", fontSize: "0.75rem", textAlign: "center", padding: "1rem" }}>No active delegations.</div>
                ) : (
                  canvas.delegations.map((d) => (
                    <div key={d.id} style={{ padding: "0.6rem", background: "rgba(0,0,0,0.2)", borderRadius: "6px", border: "1px solid var(--gc-border)", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                       <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--gc-primary)" }}>{d.parent_agent_id} ➜ {d.target_agent_id}</span>
                          <span className="gc-badge" style={{ fontSize: "0.6rem" }}>{d.status}</span>
                       </div>
                       <div style={{ marginTop: "0.3rem", color: "var(--gc-muted)", fontStyle: "italic" }}>{d.objective}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Timeline Scrubber */}
          <section className="gc-card" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Cognitive Scrubber</h3>
                <span style={{ color: "var(--gc-muted)", fontSize: "0.8rem" }}>{timeline.length} EXECUTION_EVENTS_CAPTURED</span>
             </div>

             {/* Heat-map Visualization */}
             <div style={{ 
               display: "flex", 
               gap: "2px", 
               height: "12px", 
               background: "rgba(255,255,255,0.02)", 
               borderRadius: "2px", 
               overflow: "hidden" 
             }}>
                {Array.from({ length: 120 }).map((_, i) => {
                  const eventCount = timeline.filter(e => {
                    const ts = new Date(e.timestamp).getTime();
                    const now = Date.now();
                    const bucketSize = 5000; // 5s buckets
                    return ts > now - (120 - i) * bucketSize && ts <= now - (119 - i) * bucketSize;
                  }).length;
                  const intensity = Math.min(eventCount / 10, 1);
                  return (
                    <div key={i} style={{ 
                      flex: 1, 
                      background: `rgba(25, 209, 195, ${intensity * 0.8 + 0.05})`,
                      boxShadow: intensity > 0.5 ? "0 0 5px var(--gc-primary)" : "none"
                    }} />
                  );
                })}
             </div>

             <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <input 
                  type="range" 
                  min={0} 
                  max={Math.max(0, timeline.length - 1)} 
                  value={scrubber} 
                  onChange={(e) => setScrubber(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--gc-primary)" }}
                />
             </div>
             <div style={{ 
               padding: "1rem", 
               background: "rgba(0,0,0,0.3)", 
               borderRadius: "10px", 
               border: "1px solid var(--gc-border)", 
               fontFamily: "var(--font-mono)", 
               fontSize: "0.8rem",
               maxHeight: "200px",
               overflowY: "auto",
               color: "var(--gc-primary)"
             }}>
                {selectedTimelineEvent ? (
                  <pre style={{ margin: 0 }}>{JSON.stringify(selectedTimelineEvent, null, 2)}</pre>
                ) : "Awaiting event feed..."}
             </div>
          </section>
        </>
      )}
    </div>
  );
}
