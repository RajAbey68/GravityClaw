/**
 * Agency Workspace Schema Migration
 * Adds: agency_workspaces, team_workspaces, team_members, team_messages,
 *       agency_tasks, team_shared_files, live_feed_events,
 *       terminal_sessions, terminal_history
 *
 * Run via: src/core/memory/db.ts on startup (additive only)
 */

export const agencySchemaStatements = [
  // ─── Agency Workspaces ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agency_workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    mission TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    orchestrator_agent_id TEXT,
    parent_workspace_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    config TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_agency_status ON agency_workspaces(status);`,

  // ─── Team Workspaces ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS team_workspaces (
    id TEXT PRIMARY KEY,
    agency_workspace_id TEXT NOT NULL REFERENCES agency_workspaces(id),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    lead_agent_id TEXT,
    member_limit INTEGER DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    config TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_team_agency ON team_workspaces(agency_workspace_id);`,

  // ─── Team Members ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_workspace_id TEXT NOT NULL REFERENCES team_workspaces(id),
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    specialty_tags TEXT,
    joined_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );`,

  `CREATE INDEX IF NOT EXISTS idx_team_members ON team_members(team_workspace_id, status);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_team_member_unique ON team_members(team_workspace_id, agent_id);`,

  // ─── Team Messages ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS team_messages (
    id TEXT PRIMARY KEY,
    team_workspace_id TEXT NOT NULL REFERENCES team_workspaces(id),
    sender_agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'chat',
    reply_to_id TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_team_messages ON team_messages(team_workspace_id, created_at DESC);`,

  // ─── Agency Tasks ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agency_tasks (
    id TEXT PRIMARY KEY,
    agency_workspace_id TEXT NOT NULL REFERENCES agency_workspaces(id),
    assigned_team_id TEXT REFERENCES team_workspaces(id),
    assigned_agent_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    parent_task_id TEXT,
    deliverables TEXT,
    result TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_agency_tasks ON agency_tasks(agency_workspace_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_agency_tasks_team ON agency_tasks(assigned_team_id, status);`,

  // ─── Team Shared Files ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS team_shared_files (
    id TEXT PRIMARY KEY,
    team_workspace_id TEXT NOT NULL REFERENCES team_workspaces(id),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by_agent_id TEXT NOT NULL,
    file_type TEXT,
    size_bytes INTEGER,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_team_files ON team_shared_files(team_workspace_id, created_at DESC);`,

  // ─── Live Feed Events ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS live_feed_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '⚡',
    title TEXT NOT NULL,
    detail TEXT,
    metadata TEXT,
    level TEXT NOT NULL DEFAULT 'info',
    group_id TEXT,
    created_at INTEGER NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_feed_workspace ON live_feed_events(workspace_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_feed_agent ON live_feed_events(agent_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_feed_type ON live_feed_events(event_type, created_at DESC);`,

  // ─── Terminal Sessions ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS terminal_sessions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    pid INTEGER,
    shell TEXT NOT NULL,
    cwd TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );`,

  `CREATE INDEX IF NOT EXISTS idx_term_agent ON terminal_sessions(agent_id, workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_term_status ON terminal_sessions(status);`,

  // ─── Terminal History ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS terminal_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES terminal_sessions(id),
    command TEXT NOT NULL,
    output TEXT,
    exit_code INTEGER,
    duration_ms INTEGER,
    executed_at INTEGER NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_term_history ON terminal_history(session_id, executed_at DESC);`
];
