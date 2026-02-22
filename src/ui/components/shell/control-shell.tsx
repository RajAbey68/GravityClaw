"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ControlStoreProvider, useControlStore } from "@/src/ui/state/control-store";
import { GravityLogo } from "@/src/ui/components/common/gravity-logo";
import { TalkMode } from "@/src/ui/components/voice/TalkMode";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
  { href: "/agents", label: "Agents", icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" },
  { href: "/chat", label: "Chat", icon: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" },
  { href: "/canvas", label: "Canvas", icon: "M13.5 1.5l5 5L17.41 7.59l-5-5L13.5 1.5zM21 16v2h-9v-2h9zm-11 1c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5zm-5 3c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" },
  { href: "/memory", label: "Memory", icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v2H7zm0-3h10v2H7zm0 6h10v2H7z" },
  { href: "/tools", label: "Tools", icon: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" },
  { href: "/skills", label: "Skills", icon: "M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM3.89 9L12 4.57 20.11 9 12 13.43 3.89 9z" },
  { href: "/providers", label: "Providers", icon: "M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" },
  { href: "/logs", label: "Logs", icon: "M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" },
  { href: "/settings", label: "Settings", icon: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.34 8.87c-.12.2-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" }
];

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    toggleSidebar,
    connected,
    workspaceId,
    setWorkspaceId,
    workspaces,
    loadingWorkspaces
  } = useControlStore();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--gc-bg)" }}>
      {/* 48px Slim Top Bar */}
      <header className="gc-card" style={{ 
        height: "48px", 
        display: "flex", 
        alignItems: "center", 
        padding: "0 1.2rem", 
        gap: "1.5rem",
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
        zIndex: 100,
        position: "sticky",
        top: 0,
        background: "rgba(11, 18, 22, 0.8)",
        backdropFilter: "blur(20px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flex: 1 }}>
          <GravityLogo size={28} />
          <div style={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.02em", color: "var(--gc-primary)", textTransform: "uppercase" }}>
            Gravity Claw
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--gc-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Workspace</span>
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              disabled={loadingWorkspaces}
              style={{
                border: "1px solid var(--gc-border)",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.03)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.8rem",
                minWidth: "140px",
                color: "inherit",
                outline: "none"
              }}
            >
              {workspaces.length === 0 ? (
                <option value="default">default</option>
              ) : (
                workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="gc-badge" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.6rem" }}>
            <span className={`gc-status-dot ${connected ? "status-live" : ""}`} style={{ margin: 0, width: "6px", height: "6px" }}></span>
            <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Navigation Sidebar */}
        <aside style={{ 
          width: sidebarCollapsed ? "64px" : "240px",
          borderRight: "1px solid var(--gc-border)",
          padding: "1rem 0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          background: "rgba(11, 18, 22, 0.4)",
          backdropFilter: "blur(25px)",
          position: "sticky",
          top: "48px",
          height: "calc(100vh - 48px)",
          overflow: "hidden",
          transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 90
        }}>
          <div className="gc-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: "0.25rem", paddingRight: "4px" }}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: "0.8rem",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "10px",
                    background: active ? "rgba(0, 191, 165, 0.12)" : "transparent",
                    color: active ? "var(--gc-primary)" : "var(--gc-muted)",
                    fontSize: "0.85rem",
                    fontWeight: active ? 600 : 400,
                    transition: "all 200ms ease",
                    textDecoration: "none",
                    whiteSpace: "nowrap"
                  }}
                  className={active ? "" : "gc-card-interactive"}
                  title={sidebarCollapsed ? item.label : ""}
                >
                  <svg 
                    viewBox="0 0 24 24" 
                    width="18" 
                    height="18" 
                    fill="currentColor"
                    style={{ 
                      minWidth: "18px",
                      opacity: active ? 1 : 0.7,
                      transition: "all 200ms"
                    }}
                  >
                    <path d={item.icon} />
                  </svg>
                  {!sidebarCollapsed && <span style={{ opacity: 1, transition: "opacity 200ms" }}>{item.label}</span>}
                </Link>
              );
            })}
          </div>
          
          <button
            onClick={toggleSidebar}
            style={{
              marginTop: "0.5rem",
              padding: "0.7rem",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--gc-border)",
              cursor: "pointer",
              color: "var(--gc-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 150ms"
            }}
            className="gc-card-interactive"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition: "transform 300ms" }}>
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="gc-scroll" style={{ 
          flex: 1, 
          padding: "1.5rem", 
          overflowY: "auto",
          height: "calc(100vh - 48px)",
          background: "radial-gradient(circle at 50% 0%, rgba(0, 191, 165, 0.03) 0%, transparent 70%)"
        }}>
          <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
            {children}
          </div>
        </main>
      </div>
      
      <TalkMode />
    </div>
  );
}

export function ControlShell({ children }: { children: React.ReactNode }) {
  return (
    <ControlStoreProvider>
      <ShellFrame>{children}</ShellFrame>
    </ControlStoreProvider>
  );
}

