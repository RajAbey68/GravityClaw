/**
 * TasksRepository — data access layer for mission_tasks.
 * Mirrors MissionRepository from the monolith exactly so the two
 * implementations stay in sync.
 */
import { randomUUID } from "node:crypto";
import type { TasksDb } from "./db.js";

type MissionStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type MissionPriority = "low" | "medium" | "high" | "critical";

export interface MissionTask {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: MissionStatus;
  priority: MissionPriority;
  assigned_agent_id: string | null;
  required_skills: string[];
  tags: string[];
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  deliverables: unknown[];
}

function nowTs() {
  return Date.now();
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRow(row: {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  required_skills: string | null;
  tags: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  deliverables: string | null;
}): MissionTask {
  return {
    ...row,
    status: row.status as MissionStatus,
    priority: row.priority as MissionPriority,
    required_skills: parseJsonArray(row.required_skills) as string[],
    tags: parseJsonArray(row.tags) as string[],
    deliverables: parseJsonArray(row.deliverables),
  };
}

export class TasksRepository {
  constructor(private readonly db: TasksDb) {}

  listTasks(input: {
    workspaceId: string;
    status?: MissionStatus;
    agentId?: string;
    limit?: number;
  }): Promise<MissionTask[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 120, 500));
    const params: unknown[] = [input.workspaceId];
    let where = "workspace_id = ?";
    if (input.status) {
      where += " AND status = ?";
      params.push(input.status);
    }
    if (input.agentId) {
      where += " AND assigned_agent_id = ?";
      params.push(input.agentId);
    }
    params.push(limit);
    const rows = this.db.raw
      .prepare(
        `SELECT id, workspace_id, title, description, status, priority, assigned_agent_id,
                required_skills, tags, created_at, updated_at, completed_at, deliverables
         FROM mission_tasks
         WHERE ${where}
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(...params) as Parameters<typeof mapRow>[0][];
    return Promise.resolve(rows.map(mapRow));
  }

  getTask(taskId: string): Promise<MissionTask | undefined> {
    const row = this.db.raw
      .prepare(
        `SELECT id, workspace_id, title, description, status, priority, assigned_agent_id,
                required_skills, tags, created_at, updated_at, completed_at, deliverables
         FROM mission_tasks WHERE id = ?`
      )
      .get(taskId) as Parameters<typeof mapRow>[0] | undefined;
    return Promise.resolve(row ? mapRow(row) : undefined);
  }

  async createTask(input: {
    workspaceId: string;
    title: string;
    description?: string;
    status?: MissionStatus;
    priority?: MissionPriority;
    assignedAgentId?: string;
    requiredSkills?: string[];
    tags?: string[];
    deliverables?: Array<Record<string, unknown>>;
  }): Promise<MissionTask | undefined> {
    const id = randomUUID();
    const now = nowTs();
    this.db.raw
      .prepare(
        `INSERT INTO mission_tasks (
           id, workspace_id, title, description, status, priority, assigned_agent_id,
           required_skills, tags, created_at, updated_at, completed_at, deliverables
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.workspaceId,
        input.title.trim(),
        input.description?.trim() ?? null,
        input.status ?? "inbox",
        input.priority ?? "medium",
        input.assignedAgentId ?? null,
        JSON.stringify(input.requiredSkills ?? []),
        JSON.stringify(input.tags ?? []),
        now,
        now,
        null,
        JSON.stringify(input.deliverables ?? [])
      );
    this.addEventSync({ taskId: id, eventType: "created", content: `Task created: ${input.title.trim()}`, agentId: input.assignedAgentId });
    return this.getTask(id);
  }

  async updateTask(
    taskId: string,
    patch: {
      title?: string;
      description?: string;
      status?: MissionStatus;
      priority?: MissionPriority;
      assignedAgentId?: string | null;
      requiredSkills?: string[];
      tags?: string[];
      deliverables?: Array<Record<string, unknown>>;
    }
  ): Promise<MissionTask | undefined> {
    const existing = await this.getTask(taskId);
    if (!existing) return undefined;
    const nextStatus = patch.status ?? existing.status;
    // Match monolith: clear completed_at whenever a task leaves "done" state.
    const completedAt = nextStatus === "done" ? nowTs() : null;
    this.db.raw
      .prepare(
        `UPDATE mission_tasks
         SET title = ?, description = ?, status = ?, priority = ?, assigned_agent_id = ?,
             required_skills = ?, tags = ?, updated_at = ?, completed_at = ?, deliverables = ?
         WHERE id = ?`
      )
      .run(
        patch.title?.trim() ?? existing.title,
        patch.description?.trim() ?? existing.description ?? null,
        nextStatus,
        patch.priority ?? existing.priority,
        patch.assignedAgentId !== undefined ? patch.assignedAgentId : existing.assigned_agent_id,
        JSON.stringify(patch.requiredSkills ?? existing.required_skills),
        JSON.stringify(patch.tags ?? existing.tags),
        nowTs(),
        completedAt,
        JSON.stringify(patch.deliverables ?? existing.deliverables),
        taskId
      );
    this.addEventSync({
      taskId,
      eventType: "updated",
      content: `Task updated: status=${nextStatus}`,
      agentId: (patch.assignedAgentId !== undefined ? patch.assignedAgentId : existing.assigned_agent_id) ?? undefined,
    });
    return this.getTask(taskId);
  }

  deleteTask(taskId: string): Promise<boolean> {
    this.db.raw.prepare(`DELETE FROM mission_task_events WHERE task_id = ?`).run(taskId);
    const result = this.db.raw.prepare(`DELETE FROM mission_tasks WHERE id = ?`).run(taskId);
    return Promise.resolve(result.changes > 0);
  }

  private addEventSync(input: { taskId: string; eventType: string; content?: string; agentId?: string }) {
    this.db.raw
      .prepare(
        `INSERT INTO mission_task_events (id, task_id, event_type, agent_id, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), input.taskId, input.eventType, input.agentId ?? null, input.content ?? null, nowTs());
  }
}
