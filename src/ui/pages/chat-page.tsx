"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import type { AgentDescriptor, AgentMode, RuntimeStep, TokenUsage } from "@/src/core/types";
import { useControlStore } from "@/src/ui/state/control-store";

interface LiveEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

interface ConversationRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  mode: AgentMode;
  title: string | null;
  created_at: number;
  updated_at: number;
  message_count: number;
  last_message_preview: string | null;
}

interface ConversationMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "agent" | "system";
  agent_id: string | null;
  content: string;
  tool_calls: string | null;
  metadata: string | null;
  created_at: number;
}

interface ChatRow {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  from?: string;
  to?: string;
  streamId?: string;
  pending?: boolean;
  steps?: RuntimeStep[];
  usage?: TokenUsage;
}

const SLASH_COMMANDS: Array<{ id: string; description: string; template: string }> = [
  { id: "/new", description: "Start a new conversation", template: "/new " },
  { id: "/list", description: "List saved conversations", template: "/list" },
  { id: "/status", description: "Show active agent state", template: "/status" },
  { id: "/model", description: "Switch model provider/model", template: "/model openai/gpt-4o-mini" },
  { id: "/think", description: "Set thinking depth", template: "/think medium" },
  { id: "/usage", description: "Show usage/cost totals", template: "/usage" },
  { id: "/compact", description: "Compress context", template: "/compact" },
  { id: "/search", description: "Search conversation history", template: "/search " },
  { id: "/mesh", description: "Trigger Agent Mesh for a goal", template: "/mesh " },
  { id: "/talkmode", description: "Toggle immersive voice mode", template: "/talkmode" },
  { id: "/clear", description: "Clear local chat pane only", template: "/clear" }
];

function parseUsage(metadataRaw: string | null) {
  if (!metadataRaw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(metadataRaw) as { usage?: TokenUsage };
    return parsed.usage;
  } catch {
    return undefined;
  }
}

function parseToolSteps(toolCallsRaw: string | null): RuntimeStep[] {
  if (!toolCallsRaw) {
    return [];
  }
  try {
    const parsed = JSON.parse(toolCallsRaw) as Array<{ toolId?: string; detail?: string }>;
    return parsed
      .filter((item) => Boolean(item.toolId))
      .map((item, index) => ({
        iteration: index + 1,
        phase: "tool",
        detail: item.detail ?? "",
        toolId: item.toolId
      }));
  } catch {
    return [];
  }
}

function displayConversationTitle(conversation: ConversationRecord) {
  return (
    conversation.title?.trim() ||
    conversation.last_message_preview?.slice(0, 46) ||
    `${conversation.mode} conversation`
  );
}

export function ChatPage() {
  const searchParams = useSearchParams();
  const { workspaceId, selectedAgentId, setSelectedAgentId, chatMode, setChatMode, events } = useControlStore();
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [expandedTraceIndex, setExpandedTraceIndex] = useState<number | null>(null);
  const [roundLimit, setRoundLimit] = useState(2);
  const [coordinatorId, setCoordinatorId] = useState("main");
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; type: string; path: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamByAgentRef = useRef<Record<string, string>>({});

  const roomId = useMemo(
    () => `${workspaceId}:${chatMode}:ui:chat:${chatMode === "group" ? "main" : selectedAgentId}`,
    [workspaceId, chatMode, selectedAgentId]
  );

  const targetAgentId = chatMode === "group" ? "main" : selectedAgentId;

  const loadAgents = useCallback(async () => {
    const response = await fetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as { agents?: AgentDescriptor[] };
    const list = payload.agents ?? [];
    setAgents(list);
    if (list.length > 0 && !list.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(list[0].id);
    }
    if (list.length > 0 && !list.some((agent) => agent.id === coordinatorId)) {
      setCoordinatorId(list[0].id);
    }
  }, [workspaceId, selectedAgentId, setSelectedAgentId, coordinatorId]);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const response = await fetch(
        `/api/conversations?workspaceId=${encodeURIComponent(workspaceId)}&limit=120`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        setConversations([]);
        setConversationId(undefined);
        return;
      }
      const payload = (await response.json()) as { conversations?: ConversationRecord[] };
      const list = payload.conversations ?? [];
      setConversations(list);
      setConversationId((current) => {
        if (current && list.some((item) => item.id === current)) {
          return current;
        }
        return list[0]?.id;
      });
    } finally {
      setLoadingConversations(false);
    }
  }, [workspaceId]);

  const loadMessages = useCallback(async (nextConversationId: string | undefined) => {
    if (!nextConversationId) {
      setRows([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(nextConversationId)}/messages?limit=240`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        setRows([]);
        return;
      }
      const payload = (await response.json()) as { messages?: ConversationMessageRecord[] };
      const mapped = (payload.messages ?? []).map((item) => ({
        id: item.id,
        role: item.role === "agent" ? "assistant" : item.role,
        text: item.content,
        createdAt: new Date(item.created_at).toISOString(),
        from: item.agent_id ?? undefined,
        steps: parseToolSteps(item.tool_calls),
        usage: parseUsage(item.metadata)
      }));
      setRows(mapped);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const createConversation = useCallback(async () => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        agentId: targetAgentId,
        mode: chatMode,
        title: `Conversation ${new Date().toLocaleString()}`
      })
    });
    const payload = (await response.json()) as { conversation?: ConversationRecord };
    if (!response.ok || !payload.conversation) {
      return;
    }
    setConversations((current) => [payload.conversation as ConversationRecord, ...current]);
    setConversationId(payload.conversation.id);
    setRows([]);
  }, [workspaceId, targetAgentId, chatMode]);

  useEffect(() => {
    const queryAgentId = searchParams.get("agentId");
    const queryMode = searchParams.get("mode");
    if (queryAgentId && queryAgentId !== selectedAgentId) {
      setSelectedAgentId(queryAgentId);
    }
    if (queryMode === "direct" || queryMode === "delegated" || queryMode === "group") {
      setChatMode(queryMode);
    }
  }, [searchParams, selectedAgentId, setSelectedAgentId, setChatMode]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, chatMode, selectedAgentId]);

  useEffect(() => {
    loadMessages(conversationId);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    const latest = events[0] as LiveEvent | undefined;
    if (!latest) {
      return;
    }

    if (latest.type === "agent.stream.delta" && latest.roomId === roomId) {
      const streamId = String(latest.streamId ?? "");
      if (!streamId) {
        return;
      }
      const chunk = String(latest.chunk ?? "");
      const fromAgent = String(latest.agentId ?? targetAgentId);
      streamByAgentRef.current[fromAgent] = streamId;
      setRows((current) => {
        const existingIndex = current.findIndex((row) => row.streamId === streamId);
        if (existingIndex === -1) {
          return [
            ...current,
            {
              id: `stream:${streamId}`,
              role: "assistant",
              streamId,
              pending: true,
              text: chunk,
              createdAt: String(latest.timestamp ?? new Date().toISOString()),
              from: fromAgent,
              to: "user",
              steps: []
            }
          ];
        }
        return current.map((row, index) => (index === existingIndex ? { ...row, text: `${row.text}${chunk}` } : row));
      });
      return;
    }

    if (latest.type === "agent.step.completed") {
      const agentId = String(latest.agentId ?? "");
      const streamId = streamByAgentRef.current[agentId];
      if (!streamId) {
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.streamId === streamId
            ? {
                ...row,
                steps: [
                  ...(row.steps ?? []),
                  {
                    iteration: Number(latest.iteration ?? 0),
                    phase: String(latest.step ?? "reflection").startsWith("tool")
                      ? "tool"
                      : String(latest.step ?? "reflection").startsWith("final")
                        ? "final"
                        : String(latest.step ?? "reflection").startsWith("reasoning")
                          ? "reasoning"
                          : "reflection",
                    detail: String(latest.detail ?? latest.step ?? "")
                  }
                ]
              }
            : row
        )
      );
      return;
    }

    if (latest.type === "agent.stream.completed" && latest.roomId === roomId) {
      const streamId = String(latest.streamId ?? "");
      if (!streamId) {
        return;
      }
      const fromAgent = String(latest.agentId ?? targetAgentId);
      delete streamByAgentRef.current[fromAgent];
      setRows((current) =>
        current.map((row) =>
          row.streamId === streamId
            ? {
                ...row,
                pending: false,
                text: String(latest.finalText ?? row.text),
                usage: latest.usage as TokenUsage | undefined,
                steps: (latest.steps as RuntimeStep[] | undefined) ?? row.steps
              }
            : row
        )
      );
      void loadConversations();
    }
  }, [events, roomId, targetAgentId, loadConversations]);

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob);

        try {
          const resp = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: formData
          });
          const data = await resp.json();
          if (data.text) {
            setMessage((prev) => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch (err) {
          console.error("Transcription failed", err);
        } finally {
          stream.getTracks().forEach((t) => t.stop());
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { file: fileData } = await resp.json();
      setAttachments(prev => [...prev, fileData]);
    } catch (err) {
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if ((!text && attachments.length === 0) || busy) {
      return;
    }

    setBusy(true);
    setMessage("");
    const currentAttachments = [...attachments];
    setAttachments([]);

    setRows((current) => [
      ...current,
      {
        id: `local:${Date.now()}`,
        role: "user",
        text: text || (currentAttachments.length > 0 ? `[Attached ${currentAttachments.length} file(s)]` : ""),
        createdAt: new Date().toISOString(),
        from: "user",
        to: targetAgentId
      }
    ]);

    try {
      const response = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          agentId: targetAgentId,
          message: text,
          mode: chatMode,
          roomId,
          chatId: "chat-page",
          roundLimit,
          coordinatorId,
          conversationId,
          attachments: currentAttachments
        })
      });

      const payload = (await response.json()) as {
        conversationId?: string;
        clearView?: boolean;
        result?: {
          finalText?: string;
          steps?: RuntimeStep[];
          usage?: TokenUsage;
        };
        error?: string;
      };

      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }

      if (!response.ok) {
        setRows((current) => [
          ...current,
          {
            id: `error:${Date.now()}`,
            role: "system",
            text: payload.error ?? "Failed to dispatch message.",
            createdAt: new Date().toISOString(),
            from: "system",
            to: "user"
          }
        ]);
      } else if (payload.clearView) {
        setRows([]);
      } else if (payload.result?.finalText) {
        const fallbackResult = payload.result;
        setRows((current) => {
          const hasPendingStream = current.some((row) => row.pending);
          if (hasPendingStream) {
            return current;
          }
          return [
            ...current,
            {
              id: `fallback:${Date.now()}`,
              role: "assistant",
              text: fallbackResult.finalText ?? "No response",
              createdAt: new Date().toISOString(),
              from: targetAgentId,
              to: "user",
              steps: fallbackResult.steps ?? [],
              usage: fallbackResult.usage
            }
          ];
        });
      }
      await loadConversations();
    } finally {
      setBusy(false);
    }
  }

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((item) => {
      const title = displayConversationTitle(item).toLowerCase();
      const preview = (item.last_message_preview ?? "").toLowerCase();
      return title.includes(query) || preview.includes(query);
    });
  }, [conversations, conversationSearch]);

  const slashQuery = message.trim().startsWith("/") ? message.trim().toLowerCase() : "";
  const commandSuggestions = slashQuery
    ? SLASH_COMMANDS.filter(
        (item) => item.id.startsWith(slashQuery) || item.id.includes(slashQuery.replace("/", ""))
      ).slice(0, 8)
    : [];

  const visibleRows = showSystemMessages ? rows : rows.filter((row) => row.role !== "system");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.2rem", height: "calc(100vh - 120px)" }}>
      {/* Conversation Sidebar */}
      <section className="gc-card" style={{ padding: "1rem", display: "grid", gap: "0.8rem", alignContent: "start", height: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Thread History</h3>
          <button
            onClick={createConversation}
            className="gc-button gc-button-primary"
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
          >
            New Thread
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <input
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
            placeholder="Search threads..."
            style={{ 
              width: "100%",
              border: "1px solid var(--gc-border)", 
              borderRadius: "8px", 
              padding: "0.5rem 0.75rem", 
              background: "var(--gc-surface)",
              fontSize: "0.85rem"
            }}
          />
        </div>
        <div className="gc-scroll" style={{ overflowY: "auto", display: "grid", gap: "0.5rem", paddingRight: "4px" }}>
          {loadingConversations ? (
            <div style={{ color: "var(--gc-muted)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>Retrieving threads...</div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ color: "var(--gc-muted)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No active threads.</div>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setConversationId(conversation.id)}
                className={conversationId === conversation.id ? "" : "gc-card-interactive"}
                style={{
                  textAlign: "left",
                  border: "1px solid",
                  borderColor: conversationId === conversation.id ? "var(--gc-primary)" : "var(--gc-border)",
                  borderRadius: "10px",
                  padding: "0.8rem",
                  cursor: "pointer",
                  background: conversationId === conversation.id ? "rgba(0, 191, 165, 0.1)" : "transparent",
                  transition: "all 150ms"
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: conversationId === conversation.id ? "var(--gc-primary)" : "inherit" }}>
                  {displayConversationTitle(conversation)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--gc-muted)", marginTop: "0.3rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {conversation.last_message_preview || "Empty thread"}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Main Chat Area */}
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: "1rem", height: "100%" }}>
        {/* Chat Control Bar */}
        <section className="gc-card" style={{ padding: "0.8rem 1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
             <select
              value={targetAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              disabled={chatMode === "group"}
              style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem 0.6rem", background: "var(--gc-surface)", fontSize: "0.85rem" }}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>Target: {agent.label || agent.id}</option>
              ))}
            </select>
            <select
              value={chatMode}
              onChange={(event) => setChatMode(event.target.value as AgentMode)}
              style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem 0.6rem", background: "var(--gc-surface)", fontSize: "0.85rem" }}
            >
              <option value="direct">Direct</option>
              <option value="delegated">Delegated</option>
              <option value="group">Swarm</option>
            </select>
             <select
              value={coordinatorId}
              onChange={(event) => setCoordinatorId(event.target.value)}
              style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem 0.6rem", background: "var(--gc-surface)", fontSize: "0.85rem" }}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>Coord: {agent.id}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>Rounds:</span>
              <input
                type="number"
                min={1}
                max={8}
                value={roundLimit}
                onChange={(event) => setRoundLimit(Number(event.target.value) || 1)}
                style={{ border: "1px solid var(--gc-border)", borderRadius: "8px", padding: "0.4rem", background: "var(--gc-surface)", width: "50px", fontSize: "0.85rem", textAlign: "center" }}
              />
            </div>
            <button
              onClick={() => useControlStore.getState().setTalkModeOpen(true)}
              className="gc-button gc-button-primary"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span style={{ fontSize: "1rem" }}>🎤</span>
              Talk
            </button>
            <button
              onClick={() => setShowSystemMessages((current) => !current)}
              className="gc-button"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
            >
              {showSystemMessages ? "Hide System" : "Show System"}
            </button>
            <button
              onClick={() => loadMessages(conversationId)}
              className="gc-button"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
            >
              Reload
            </button>
          </div>
        </section>

        {/* Message Feed */}
        <section className="gc-card" style={{ padding: "1.5rem", position: "relative", overflow: "hidden", display: "grid", gridTemplateRows: "1fr" }}>
          <div className="gc-scroll" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingRight: "1rem" }}>
            {loadingMessages ? (
              <div style={{ color: "var(--gc-muted)", fontSize: "0.9rem", textAlign: "center", padding: "2rem" }}>Loading conversation history...</div>
            ) : visibleRows.length === 0 ? (
              <div style={{ color: "var(--gc-muted)", fontSize: "0.9rem", textAlign: "center", padding: "2rem" }}>No messages in this thread.</div>
            ) : (
              visibleRows.map((row, index) => {
                const isUser = row.role === "user";
                const isSystem = row.role === "system";
                const toolSteps = (row.steps ?? []).filter((step) => step.phase === "tool" && step.toolId);
                
                return (
                  <div
                    key={row.id || `${row.createdAt}-${index}`}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: isSystem ? "100%" : "85%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                      gap: "0.4rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.75rem", color: "var(--gc-muted)", margin: "0 0.4rem" }}>
                      {!isUser && <strong>{row.from || "Assistant"}</strong>}
                      <span>{new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isUser && <strong>You</strong>}
                      
                      <div className="gc-message-actions" style={{ marginLeft: "0.5rem", display: "flex", gap: "0.4rem", opacity: 0.6 }}>
                        <button 
                          onClick={() => navigator.clipboard.writeText(row.text)}
                          style={{ background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer", fontSize: "0.7rem", padding: "2px" }}
                          title="Copy"
                        >
                          ⎘
                        </button>
                        {!isUser && (
                           <button 
                            onClick={() => { /* Retry logic */ }}
                            style={{ background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer", fontSize: "0.7rem", padding: "2px" }}
                            title="Retry"
                          >
                            ↺
                          </button>
                        )}
                        <button 
                          onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                          style={{ background: "none", border: "none", color: "var(--gc-muted)", cursor: "pointer", fontSize: "0.7rem", padding: "2px" }}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    
                    <div
                      className="gc-markdown-body"
                      style={{
                        padding: isSystem ? "0.6rem 1rem" : "1rem 1.2rem",
                        borderRadius: "14px",
                        borderBottomRightRadius: isUser ? "2px" : "14px",
                        borderBottomLeftRadius: !isUser ? "2px" : "14px",
                        background: isUser ? "rgba(0, 191, 165, 0.1)" : isSystem ? "rgba(255, 94, 94, 0.05)" : "rgba(255, 255, 255, 0.03)",
                        border: "1px solid",
                        borderColor: isUser ? "var(--gc-primary-soft)" : isSystem ? "var(--gc-danger-soft)" : "var(--gc-border)",
                        color: isSystem ? "var(--gc-danger)" : "inherit",
                        fontSize: "0.95rem",
                        lineHeight: "1.5",
                        whiteSpace: "normal",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                        overflowX: "auto"
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          pre: ({ node, ...props }) => <pre style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--gc-border)", overflowX: "auto", margin: "0.8rem 0" }} {...props} />,
                          code: ({ node, inline, ...props }: any) => 
                            inline 
                              ? <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 4px", borderRadius: "4px", fontFamily: "var(--font-mono)" }} {...props} />
                              : <code {...props} />,
                          table: ({ node, ...props }) => (
                            <div style={{ overflowX: "auto", margin: "1rem 0" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid var(--gc-border)" }} {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => <th style={{ border: "1px solid var(--gc-border)", padding: "0.6rem", background: "rgba(255,255,255,0.05)", textAlign: "left" }} {...props} />,
                          td: ({ node, ...props }) => <td style={{ border: "1px solid var(--gc-border)", padding: "0.6rem" }} {...props} />,
                          p: ({ node, ...props }) => <p style={{ margin: "0.5rem 0" }} {...props} />,
                          ul: ({ node, ...props }) => <ul style={{ marginLeft: "1.5rem", marginBottom: "0.5rem" }} {...props} />,
                          ol: ({ node, ...props }) => <ol style={{ marginLeft: "1.5rem", marginBottom: "0.5rem" }} {...props} />
                        }}
                      >
                        {row.text}
                      </ReactMarkdown>
                      {row.pending && (
                        <span style={{ 
                          display: "inline-block", 
                          width: "3px", 
                          height: "1rem", 
                          background: "var(--gc-primary)", 
                          marginLeft: "4px",
                          animation: "pulse 1s infinite",
                          verticalAlign: "middle"
                        }} />
                      )}
                    </div>

                    {toolSteps.length > 0 && !isSystem && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "0.2rem 0.4rem" }}>
                        {toolSteps.map((step, si) => (
                           <div key={si} className="gc-badge" style={{ background: "rgba(0, 191, 165, 0.1)", borderColor: "var(--gc-primary-soft)", fontSize: "0.68rem" }}>
                              <span style={{ color: "var(--gc-primary)", marginRight: "4px" }}>λ</span>
                              {step.toolId}
                           </div>
                        ))}
                      </div>
                    )}

                    {!isUser && !isSystem && (row.steps?.length ?? 0) > 0 && (
                      <div style={{ margin: "0 0.4rem" }}>
                        <button
                          onClick={() => setExpandedTraceIndex(expandedTraceIndex === index ? null : index)}
                          style={{ background: "none", border: "none", padding: 0, color: "var(--gc-primary)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
                        >
                          {expandedTraceIndex === index ? "Hide Cognitive Trace" : "View Cognitive Trace"}
                        </button>
                        {expandedTraceIndex === index && (
                          <div style={{ 
                            marginTop: "0.6rem", 
                            padding: "0.8rem", 
                            borderRadius: "8px", 
                            background: "rgba(0,0,0,0.2)", 
                            border: "1px solid var(--gc-border)",
                            display: "grid",
                            gap: "0.25rem"
                          }}>
                            {row.steps?.map((step, si) => (
                              <div key={si} style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--gc-muted)" }}>
                                <span style={{ color: "white", opacity: 0.5 }}>{step.iteration}.{step.phase}</span> :: {step.detail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {row.usage && !isUser && (
                      <div style={{ fontSize: "0.7rem", color: "var(--gc-muted)", margin: "0.2rem 0.4rem", fontFamily: "var(--font-mono)" }}>
                        Tokens: {row.usage.inputTokens}↑ {row.usage.outputTokens}↓ • ${row.usage.estimatedCostUsd.toFixed(5)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Suggestions Dropdown */}
          {commandSuggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: "1.5rem",
                right: "1.5rem",
                bottom: "5rem",
                border: "1px solid var(--gc-primary-soft)",
                borderRadius: "12px",
                background: "var(--gc-surface)",
                display: "grid",
                gap: "0.2rem",
                padding: "0.5rem",
                zIndex: 10,
                boxShadow: "0 10px 40px rgba(0,0,0,0.4)"
              }}
            >
              {commandSuggestions.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => setMessage(cmd.template)}
                  className="gc-card-interactive"
                  style={{
                    border: "none",
                    borderRadius: "8px",
                    background: "transparent",
                    textAlign: "left",
                    padding: "0.6rem 0.8rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--gc-primary)" }}>{cmd.id}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)" }}>{cmd.description}</span>
                  </div>
                  <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>Tab to autocomplete</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Input Area */}
        <section className="gc-card" style={{ padding: "1rem 1.5rem" }}>
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.8rem" }}>
              {attachments.map((file) => (
                <div key={file.id} className="gc-badge" style={{ padding: "0.3rem 0.6rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.7rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                  <button 
                    onClick={() => setAttachments(prev => prev.filter(f => f.id !== file.id))}
                    style={{ background: "none", border: "none", color: "var(--gc-danger)", cursor: "pointer", padding: "0 2px", fontSize: "0.8rem", fontWeight: "bold" }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={send} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.8rem", alignItems: "center" }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="gc-button"
              style={{ 
                width: "42px", 
                height: "42px", 
                borderRadius: "12px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: "1.2rem",
                padding: 0
              }}
            >
              +
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              className={`gc-button ${isRecording ? "gc-button-danger" : ""}`}
              style={{ 
                width: "42px", 
                height: "42px", 
                borderRadius: "12px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: "1.2rem",
                padding: 0,
                background: isRecording ? "var(--gc-danger)" : "transparent",
                color: isRecording ? "white" : "inherit",
                animation: isRecording ? "pulse 1.5s infinite" : "none"
              }}
            >
              {isRecording ? "●" : "🎤"}
            </button>
            <div style={{ position: "relative" }}>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={chatMode === "group" ? "Broadcast instruction to swarm..." : "Prompt agent or type / to use commands..."}
                style={{ 
                  width: "100%",
                  border: "1px solid var(--gc-border)", 
                  borderRadius: "12px", 
                  padding: "0.8rem 1rem", 
                  background: "var(--gc-surface)",
                  fontSize: "1rem"
                }}
              />
            </div>
            <button
              type="submit"
              disabled={busy || (!message.trim() && attachments.length === 0)}
              className="gc-button gc-button-primary"
              style={{ 
                padding: "0.8rem 1.5rem", 
                borderRadius: "12px", 
                fontWeight: 600,
                boxShadow: (message.trim() || attachments.length > 0) ? "0 4px 15px rgba(0, 191, 165, 0.2)" : "none"
              }}
            >
              {busy ? "Thinking..." : "Execute"}
            </button>
          </form>
          <div style={{ marginTop: "0.6rem", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--gc-muted)", padding: "0 0.2rem" }}>
            <span>Workspace: {workspaceId}</span>
            <span>Target: {selectedAgentId} ({chatMode})</span>
          </div>
        </section>
      </div>
    </div>
  );
}
