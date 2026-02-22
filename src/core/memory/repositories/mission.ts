import { randomUUID } from "node:crypto";
import { SQLiteMemoryDB } from "@/src/core/memory/db";

type MissionStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type MissionPriority = "low" | "medium" | "high" | "critical";

function nowTs() {
  return Date.now();
}

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class MissionRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async listTasks(input: { workspaceId: string; status?: MissionStatus; agentId?: string; limit?: number }) {
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
    const rows = await this.db.all<{
      id: string;
      workspace_id: string;
      title: string;
      description: string | null;
      status: MissionStatus;
      priority: MissionPriority;
      assigned_agent_id: string | null;
      required_skills: string | null;
      tags: string | null;
      created_at: number;
      updated_at: number;
      completed_at: number | null;
      deliverables: string | null;
    }>(
      `SELECT id, workspace_id, title, description, status, priority, assigned_agent_id, required_skills, tags,
              created_at, updated_at, completed_at, deliverables
       FROM mission_tasks
       WHERE ${where}
       ORDER BY updated_at DESC
       LIMIT ?`,
      params
    );
    return rows.map((row) => ({
      ...row,
      required_skills: parseJsonArray(row.required_skills),
      tags: parseJsonArray(row.tags),
      deliverables: parseJsonArray(row.deliverables)
    }));
  }

  async getTask(taskId: string) {
    const row = await this.db.get<{
      id: string;
      workspace_id: string;
      title: string;
      description: string | null;
      status: MissionStatus;
      priority: MissionPriority;
      assigned_agent_id: string | null;
      required_skills: string | null;
      tags: string | null;
      created_at: number;
      updated_at: number;
      completed_at: number | null;
      deliverables: string | null;
    }>(
      `SELECT id, workspace_id, title, description, status, priority, assigned_agent_id, required_skills, tags,
              created_at, updated_at, completed_at, deliverables
       FROM mission_tasks
       WHERE id = ?`,
      [taskId]
    );
    if (!row) return undefined;
    return {
      ...row,
      required_skills: parseJsonArray(row.required_skills),
      tags: parseJsonArray(row.tags),
      deliverables: parseJsonArray(row.deliverables)
    };
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
  }) {
    const id = randomUUID();
    const createdAt = nowTs();
    await this.db.run(
      `INSERT INTO mission_tasks (
         id, workspace_id, title, description, status, priority, assigned_agent_id, required_skills, tags,
         created_at, updated_at, completed_at, deliverables
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.workspaceId,
        input.title.trim(),
        input.description?.trim() || null,
        input.status ?? "inbox",
        input.priority ?? "medium",
        input.assignedAgentId ?? null,
        JSON.stringify(input.requiredSkills ?? []),
        JSON.stringify(input.tags ?? []),
        createdAt,
        createdAt,
        null,
        JSON.stringify(input.deliverables ?? [])
      ]
    );
    await this.addTaskEvent({
      taskId: id,
      eventType: "created",
      content: `Task created: ${input.title.trim()}`,
      agentId: input.assignedAgentId
    });
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
  ) {
    const existing = await this.getTask(taskId);
    if (!existing) return undefined;
    const nextStatus = patch.status ?? existing.status;
    const completedAt = nextStatus === "done" ? nowTs() : null;
    await this.db.run(
      `UPDATE mission_tasks
       SET title = ?,
           description = ?,
           status = ?,
           priority = ?,
           assigned_agent_id = ?,
           required_skills = ?,
           tags = ?,
           updated_at = ?,
           completed_at = ?,
           deliverables = ?
       WHERE id = ?`,
      [
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
      ]
    );
    await this.addTaskEvent({
      taskId,
      eventType: "updated",
      content: `Task updated: status=${nextStatus}`,
      agentId: patch.assignedAgentId ?? existing.assigned_agent_id ?? undefined
    });
    return this.getTask(taskId);
  }

  async deleteTask(taskId: string) {
    await this.db.run(`DELETE FROM mission_task_events WHERE task_id = ?`, [taskId]);
    const result = await this.db.run(`DELETE FROM mission_tasks WHERE id = ?`, [taskId]);
    return result.changes > 0;
  }

  async addTaskEvent(input: {
    taskId: string;
    eventType: string;
    content?: string;
    agentId?: string;
    id?: string;
  }) {
    const id = input.id ?? randomUUID();
    await this.db.run(
      `INSERT INTO mission_task_events (id, task_id, agent_id, event_type, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.taskId, input.agentId ?? null, input.eventType, input.content ?? null, nowTs()]
    );
    return id;
  }

  async listTaskEvents(taskId: string, limit = 200) {
    const capped = Math.max(1, Math.min(limit, 1000));
    return this.db.all<{
      id: string;
      task_id: string;
      agent_id: string | null;
      event_type: string;
      content: string | null;
      created_at: number;
    }>(
      `SELECT id, task_id, agent_id, event_type, content, created_at
       FROM mission_task_events
       WHERE task_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [taskId, capped]
    );
  }
}
