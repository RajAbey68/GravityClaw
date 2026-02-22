import { randomUUID } from "node:crypto";
import { SQLiteMemoryDB } from "@/src/core/memory/db";

export interface WorkspaceRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function now() {
  return new Date().toISOString();
}

function mapWorkspace(row: {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toWorkspaceId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `workspace-${randomUUID().slice(0, 8)}`;
}

export class WorkspaceRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async ensureDefault() {
    const existing = await this.db.get<{ id: string }>(
      `SELECT id FROM workspaces WHERE id = 'default'`
    );
    if (existing) {
      return;
    }

    const stamp = now();
    await this.db.run(
      `INSERT INTO workspaces (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      ["default", "Default Workspace", "Primary local workspace", stamp, stamp]
    );
  }

  async list() {
    const rows = await this.db.all<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, description, created_at, updated_at
       FROM workspaces
       ORDER BY created_at ASC`
    );

    return rows.map(mapWorkspace);
  }

  async get(workspaceId: string) {
    const row = await this.db.get<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, description, created_at, updated_at
       FROM workspaces
       WHERE id = ?`,
      [workspaceId]
    );

    return row ? mapWorkspace(row) : undefined;
  }

  async create(input: { name: string; description?: string; id?: string }) {
    const workspaceId = input.id ? toWorkspaceId(input.id) : toWorkspaceId(input.name);
    const exists = await this.get(workspaceId);
    if (exists) {
      throw new Error(`Workspace '${workspaceId}' already exists.`);
    }

    const stamp = now();
    await this.db.run(
      `INSERT INTO workspaces (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, input.name.trim(), input.description?.trim() ?? null, stamp, stamp]
    );

    return workspaceId;
  }

  async update(workspaceId: string, input: { name?: string; description?: string }) {
    const found = await this.get(workspaceId);
    if (!found) return undefined;

    await this.db.run(
      `UPDATE workspaces
       SET name = ?, description = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name?.trim() || found.name,
        input.description?.trim() ?? found.description ?? null,
        now(),
        workspaceId
      ]
    );

    return this.get(workspaceId);
  }

  async delete(workspaceId: string) {
    if (workspaceId === "default") {
      throw new Error("Cannot delete default workspace.");
    }
    await this.db.run(`DELETE FROM workspace_configs WHERE workspace_id = ?`, [workspaceId]);
    await this.db.run(`DELETE FROM workspaces WHERE id = ?`, [workspaceId]);
  }

  async cloneWorkspace(sourceWorkspaceId: string, target: { id?: string; name: string; description?: string }) {
    const source = await this.get(sourceWorkspaceId);
    if (!source) {
      throw new Error(`Workspace '${sourceWorkspaceId}' not found.`);
    }

    const clonedId = await this.create({
      id: target.id,
      name: target.name,
      description: target.description ?? `Clone of ${source.name}`
    });

    const sourceConfigs = await this.db.all<{ key: string; value: string }>(
      `SELECT key, value
       FROM workspace_configs
       WHERE workspace_id = ?`,
      [sourceWorkspaceId]
    );

    for (const config of sourceConfigs) {
      await this.setConfig(clonedId, config.key, config.value);
    }

    return clonedId;
  }

  async setConfig(workspaceId: string, key: string, value: string) {
    await this.db.run(
      `INSERT INTO workspace_configs (workspace_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(workspace_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [workspaceId, key, value, now()]
    );
  }

  async getConfig(workspaceId: string, key: string) {
    const row = await this.db.get<{ value: string }>(
      `SELECT value FROM workspace_configs WHERE workspace_id = ? AND key = ?`,
      [workspaceId, key]
    );
    return row?.value;
  }

  async listConfigs(workspaceId: string) {
    return this.db.all<{ key: string; value: string; updated_at: string }>(
      `SELECT key, value, updated_at
       FROM workspace_configs
       WHERE workspace_id = ?
       ORDER BY key ASC`,
      [workspaceId]
    );
  }
}

