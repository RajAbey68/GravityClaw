/**
 * Thin synchronous SQLite wrapper using better-sqlite3.
 * Mirrors the interface of the monolith's SQLiteMemoryDB but uses the
 * synchronous driver — simpler for a small dedicated service.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Minimal schema for the mission_tasks and mission_task_events tables. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mission_tasks (
     id TEXT PRIMARY KEY,
     workspace_id TEXT NOT NULL,
     title TEXT NOT NULL,
     description TEXT,
     status TEXT NOT NULL DEFAULT 'inbox',
     priority TEXT NOT NULL DEFAULT 'medium',
     assigned_agent_id TEXT,
     required_skills TEXT NOT NULL DEFAULT '[]',
     tags TEXT NOT NULL DEFAULT '[]',
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     completed_at INTEGER,
     deliverables TEXT NOT NULL DEFAULT '[]'
   )`,
  `CREATE INDEX IF NOT EXISTS idx_mt_workspace ON mission_tasks(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mt_status ON mission_tasks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_mt_agent ON mission_tasks(assigned_agent_id)`,
  `CREATE TABLE IF NOT EXISTS mission_task_events (
     id TEXT PRIMARY KEY,
     task_id TEXT NOT NULL REFERENCES mission_tasks(id) ON DELETE CASCADE,
     event_type TEXT NOT NULL,
     agent_id TEXT,
     content TEXT,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_mte_task ON mission_task_events(task_id)`,
];

export class TasksDb {
  constructor(readonly raw: Database.Database) {}

  init(): void {
    this.raw.pragma("journal_mode = WAL");
    this.raw.pragma("foreign_keys = ON");
    for (const stmt of SCHEMA) {
      this.raw.exec(stmt);
    }
  }
}

/** Open (or create) a SQLite database at the given path. */
export function openDb(dbPath: string): TasksDb {
  mkdirSync(dirname(dbPath), { recursive: true });
  const raw = new Database(dbPath);
  const db = new TasksDb(raw);
  db.init();
  return db;
}
