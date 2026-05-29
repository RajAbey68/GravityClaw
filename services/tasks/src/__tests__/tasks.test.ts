/**
 * Tasks service — unit tests (TDD, written before implementation).
 *
 * Uses an in-memory SQLite database so tests are fast, deterministic, and
 * leave no filesystem artefacts.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { TasksDb } from "../db.js";
import { TasksRepository } from "../repository.js";

function makeInMemoryRepo(): { repo: TasksRepository; db: Database.Database } {
  const raw = new Database(":memory:");
  const db = new TasksDb(raw);
  db.init();
  const repo = new TasksRepository(db);
  return { repo, db: raw };
}

describe("TasksRepository", () => {
  let repo: TasksRepository;
  let raw: Database.Database;

  beforeEach(() => {
    ({ repo, db: raw } = makeInMemoryRepo());
  });

  afterEach(() => {
    raw.close();
  });

  // ── listTasks ────────────────────────────────────────────────────────────

  it("returns empty array when no tasks exist", async () => {
    const tasks = await repo.listTasks({ workspaceId: "default" });
    expect(tasks).toEqual([]);
  });

  it("returns tasks for the given workspace only", async () => {
    await repo.createTask({ workspaceId: "ws-a", title: "Task A" });
    await repo.createTask({ workspaceId: "ws-b", title: "Task B" });

    const result = await repo.listTasks({ workspaceId: "ws-a" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Task A");
  });

  it("filters by status", async () => {
    await repo.createTask({ workspaceId: "default", title: "Inbox task", status: "inbox" });
    await repo.createTask({ workspaceId: "default", title: "Done task", status: "done" });

    const inbox = await repo.listTasks({ workspaceId: "default", status: "inbox" });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].status).toBe("inbox");
  });

  it("filters by assignedAgentId", async () => {
    await repo.createTask({ workspaceId: "default", title: "Assigned", assignedAgentId: "agent-1" });
    await repo.createTask({ workspaceId: "default", title: "Unassigned" });

    const result = await repo.listTasks({ workspaceId: "default", agentId: "agent-1" });
    expect(result).toHaveLength(1);
    expect(result[0].assigned_agent_id).toBe("agent-1");
  });

  it("respects limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await repo.createTask({ workspaceId: "default", title: `Task ${i}` });
    }
    const result = await repo.listTasks({ workspaceId: "default", limit: 3 });
    expect(result).toHaveLength(3);
  });

  // ── createTask ───────────────────────────────────────────────────────────

  it("creates a task with required fields", async () => {
    const task = await repo.createTask({ workspaceId: "default", title: "New task" });
    expect(task).toBeDefined();
    expect(task!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(task!.title).toBe("New task");
    expect(task!.status).toBe("inbox");
    expect(task!.priority).toBe("medium");
  });

  it("creates a task with all optional fields", async () => {
    const task = await repo.createTask({
      workspaceId: "default",
      title: "Full task",
      description: "A description",
      status: "assigned",
      priority: "high",
      assignedAgentId: "agent-42",
      requiredSkills: ["typescript", "sql"],
      tags: ["urgent"],
    });
    expect(task!.description).toBe("A description");
    expect(task!.status).toBe("assigned");
    expect(task!.priority).toBe("high");
    expect(task!.assigned_agent_id).toBe("agent-42");
    expect(task!.required_skills).toEqual(["typescript", "sql"]);
    expect(task!.tags).toEqual(["urgent"]);
  });

  it("trims whitespace from title", async () => {
    const task = await repo.createTask({ workspaceId: "default", title: "  trimmed  " });
    expect(task!.title).toBe("trimmed");
  });

  // ── getTask ──────────────────────────────────────────────────────────────

  it("returns undefined for unknown task id", async () => {
    const result = await repo.getTask("00000000-0000-0000-0000-000000000000");
    expect(result).toBeUndefined();
  });

  it("retrieves a task by id", async () => {
    const created = await repo.createTask({ workspaceId: "default", title: "Find me" });
    const found = await repo.getTask(created!.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created!.id);
  });

  // ── updateTask ───────────────────────────────────────────────────────────

  it("returns undefined when updating a non-existent task", async () => {
    const result = await repo.updateTask("00000000-0000-0000-0000-000000000000", { status: "done" });
    expect(result).toBeUndefined();
  });

  it("updates status and sets completed_at when status is done", async () => {
    const task = await repo.createTask({ workspaceId: "default", title: "Complete me" });
    const updated = await repo.updateTask(task!.id, { status: "done" });
    expect(updated!.status).toBe("done");
    expect(updated!.completed_at).not.toBeNull();
  });

  it("updates partial fields without losing others", async () => {
    const task = await repo.createTask({
      workspaceId: "default",
      title: "Original",
      priority: "high",
      tags: ["keep-me"],
    });
    const updated = await repo.updateTask(task!.id, { title: "Updated" });
    expect(updated!.title).toBe("Updated");
    expect(updated!.priority).toBe("high");
    expect(updated!.tags).toEqual(["keep-me"]);
  });

  it("clears tags when an explicit empty array is passed", async () => {
    const task = await repo.createTask({
      workspaceId: "default",
      title: "Tagged",
      tags: ["remove-me"],
    });
    const updated = await repo.updateTask(task!.id, { tags: [] });
    expect(updated!.tags).toEqual([]);
  });

  // ── deleteTask ───────────────────────────────────────────────────────────

  it("returns false when deleting a non-existent task", async () => {
    const result = await repo.deleteTask("00000000-0000-0000-0000-000000000000");
    expect(result).toBe(false);
  });

  it("deletes an existing task and returns true", async () => {
    const task = await repo.createTask({ workspaceId: "default", title: "Delete me" });
    const deleted = await repo.deleteTask(task!.id);
    expect(deleted).toBe(true);
    const found = await repo.getTask(task!.id);
    expect(found).toBeUndefined();
  });
});
