"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { AgentMode } from "@/src/core/types";

export interface WorkspaceItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveSystemEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

interface ControlStoreValue {
  workspaces: WorkspaceItem[];
  workspaceId: string;
  setWorkspaceId: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedAgentId: string;
  setSelectedAgentId: (agentId: string) => void;
  chatMode: AgentMode;
  setChatMode: (mode: AgentMode) => void;
  loadingWorkspaces: boolean;
  isTalkModeOpen: boolean;
  setTalkModeOpen: (open: boolean) => void;
}

const ControlStoreContext = createContext<ControlStoreValue | undefined>(undefined);

function storageKey(suffix: string) {
  return `gravity-claw:${suffix}`;
}

export function ControlStoreProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaceId, setWorkspaceIdState] = useState("default");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAgentId, setSelectedAgentIdState] = useState("main");
  const [chatMode, setChatModeState] = useState<AgentMode>("direct");
  const [events, setEvents] = useState<LiveSystemEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [isTalkModeOpen, setTalkModeOpen] = useState(false);
  const hydratedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const response = await fetch("/api/workspaces", { cache: "no-store" });
      const data = (await response.json()) as { workspaces?: WorkspaceItem[] };
      const items = data.workspaces ?? [];
      setWorkspaces(items);
      if (items.length > 0 && !items.some((workspace) => workspace.id === workspaceId)) {
        setWorkspaceIdState(items[0].id);
      }
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const persistedWorkspace = window.localStorage.getItem(storageKey("workspace"));
      const persistedCollapsed = window.localStorage.getItem(storageKey("sidebar-collapsed"));
      const persistedAgentId = window.localStorage.getItem(storageKey("agent"));
      const persistedMode = window.localStorage.getItem(storageKey("chat-mode"));
      if (persistedWorkspace) setWorkspaceIdState(persistedWorkspace);
      if (persistedCollapsed) setSidebarCollapsed(persistedCollapsed === "1");
      if (persistedAgentId) setSelectedAgentIdState(persistedAgentId);
      if (persistedMode === "direct" || persistedMode === "delegated" || persistedMode === "group" || persistedMode === "hive") {
        setChatModeState(persistedMode);
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey("workspace"), workspaceId);
    } catch {
      // ignore
    }
  }, [workspaceId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey("sidebar-collapsed"), sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey("agent"), selectedAgentId);
    } catch {
      // ignore
    }
  }, [selectedAgentId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey("chat-mode"), chatMode);
    } catch {
      // ignore
    }
  }, [chatMode]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempts = 0;
    let closedByEffect = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/api/events/ws`);

      socket.onopen = () => {
        reconnectAttempts = 0;
        setConnected(true);
      };

      socket.onclose = () => {
        setConnected(false);
        if (closedByEffect) return;
        const delay = Math.min(10_000, 800 * (reconnectAttempts + 1));
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => setConnected(false);
      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as LiveSystemEvent;
          const eventId = typeof payload.eventId === "string" ? payload.eventId : "";
          if (eventId && seenEventIdsRef.current.has(eventId)) {
            return;
          }
          if (eventId) {
            seenEventIdsRef.current.add(eventId);
            if (seenEventIdsRef.current.size > 1500) {
              const entries = [...seenEventIdsRef.current].slice(-900);
              seenEventIdsRef.current = new Set(entries);
            }
          }
          setEvents((current) => [payload, ...current].slice(0, 800));
        } catch {
          // ignore malformed payload
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const value = useMemo<ControlStoreValue>(
    () => ({
      workspaces,
      workspaceId,
      setWorkspaceId: setWorkspaceIdState,
      refreshWorkspaces,
      sidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((current) => !current),
      selectedAgentId,
      setSelectedAgentId: setSelectedAgentIdState,
      chatMode,
      setChatMode: setChatModeState,
      connected,
      loadingWorkspaces,
      isTalkModeOpen,
      setTalkModeOpen
    }),
    [
      workspaces,
      workspaceId,
      refreshWorkspaces,
      sidebarCollapsed,
      selectedAgentId,
      chatMode,
      events,
      connected,
      loadingWorkspaces,
      isTalkModeOpen
    ]
  );

  return <ControlStoreContext.Provider value={value}>{children}</ControlStoreContext.Provider>;
}

export function useControlStore() {
  const context = useContext(ControlStoreContext);
  if (!context) {
    throw new Error("useControlStore must be used inside ControlStoreProvider.");
  }
  return context;
}
