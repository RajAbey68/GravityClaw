export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL UNIQUE,
    agent_id TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS runtime_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    iteration INTEGER NOT NULL,
    phase TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS tool_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    risk TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS provider_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    estimated_cost_usd REAL NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS memory_annotations (
    memory_id INTEGER PRIMARY KEY,
    pinned INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed INTEGER,
    summary TEXT,
    topic_cluster TEXT,
    updated_at TEXT NOT NULL
  );`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
   USING fts5(content, namespace UNINDEXED, kind UNINDEXED, content='memories', content_rowid='id');`,
  `CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
     INSERT INTO memories_fts(rowid, content, namespace, kind)
     VALUES (new.id, new.content, new.namespace, new.kind);
   END;`,
  `CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
     INSERT INTO memories_fts(memories_fts, rowid, content, namespace, kind)
     VALUES('delete', old.id, old.content, old.namespace, old.kind);
   END;`,
  `CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
     INSERT INTO memories_fts(memories_fts, rowid, content, namespace, kind)
     VALUES('delete', old.id, old.content, old.namespace, old.kind);
     INSERT INTO memories_fts(rowid, content, namespace, kind)
     VALUES (new.id, new.content, new.namespace, new.kind);
   END;`,
  `CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS forge_jobs (
    id TEXT PRIMARY KEY,
    trigger TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    capability TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    failure_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS forge_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    target_path TEXT NOT NULL,
    diff_path TEXT NOT NULL,
    summary TEXT NOT NULL,
    prev_hash TEXT,
    curr_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS agent_rooms (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    coordinator_id TEXT NOT NULL,
    round_limit INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS delegation_tasks (
    id TEXT PRIMARY KEY,
    parent_agent_id TEXT NOT NULL,
    target_agent_id TEXT NOT NULL,
    objective TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS call_sessions (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    sid TEXT,
    controlling_agent_id TEXT NOT NULL,
    to_number TEXT NOT NULL,
    from_number TEXT,
    state TEXT NOT NULL,
    context_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS call_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS skill_registry (
    id TEXT PRIMARY KEY,
    source_path TEXT NOT NULL,
    version TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    scope_default TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS agent_skill_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    isolated_copy_path TEXT,
    mode TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS proactive_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    cron_expr TEXT,
    pattern_json TEXT,
    enabled INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS proactive_runs (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    status TEXT NOT NULL,
    output_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workspace_configs (
    workspace_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(workspace_id, key)
  );`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'direct',
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_preview TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL,
    agent_id TEXT,
    content TEXT NOT NULL,
    tool_calls TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_conv_workspace ON conversations(workspace_id, updated_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_conv_msgs ON conversation_messages(conversation_id, created_at ASC);`,
  `CREATE TABLE IF NOT EXISTS mission_tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'inbox',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_agent_id TEXT,
    required_skills TEXT,
    tags TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    deliverables TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS mission_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES mission_tasks(id),
    agent_id TEXT,
    event_type TEXT NOT NULL,
    content TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_mission_workspace_status ON mission_tasks(workspace_id, status, updated_at DESC);`,
  `CREATE TABLE IF NOT EXISTS proactive_patterns (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    confidence REAL NOT NULL DEFAULT 0,
    last_seen INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_proactive_patterns_workspace ON proactive_patterns(workspace_id, pattern_type, last_seen DESC);`,
  `CREATE TABLE IF NOT EXISTS hives (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS swarm_members (
    hive_id TEXT NOT NULL REFERENCES hives(id),
    agent_id TEXT NOT NULL,
    role TEXT DEFAULT 'worker',
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (hive_id, agent_id)
  );`,
  `CREATE TABLE IF NOT EXISTS live_feed_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    hive_id TEXT,
    event_type TEXT NOT NULL,
    actor_id TEXT,
    actor_type TEXT,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    parent_id TEXT,
    voice_id TEXT,
    voice_stability REAL,
    voice_similarity_boost REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);`,
];
