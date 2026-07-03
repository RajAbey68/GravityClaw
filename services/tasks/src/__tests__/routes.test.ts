/**
 * Tasks service — HTTP route integration tests.
 *
 * Uses supertest against the Express app (no real port bound in test mode)
 * and an in-memory SQLite database so tests are fast and leave no artefacts.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { TasksDb } from "../db.js";
import { TasksRepository } from "../repository.js";
import { createTasksRouter } from "../routes.js";
import express from "express";
import type { Request, Response, NextFunction } from "express";

function makeTestApp(internalKey?: string) {
  const raw = new Database(":memory:");
  const db = new TasksDb(raw);
  db.init();
  const repo = new TasksRepository(db);

  const app = express();
  app.use(express.json());
  app.use("/", createTasksRouter(repo, internalKey));
  // Terminal error middleware required so wrapAsync-forwarded errors return 500
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: "internal server error" });
  });

  return { app, raw };
}

describe("GET /tasks", () => {
  let raw: Database.Database;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    ({ app, raw } = makeTestApp());
  });
  afterEach(() => raw.close());

  it("returns empty tasks array for unknown workspace", async () => {
    const res = await request(app).get("/tasks?workspaceId=unknown");
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  it("returns 400 for invalid status filter", async () => {
    const res = await request(app).get("/tasks?status=invalid");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid status");
  });
});

describe("GET /tasks/:id", () => {
  let raw: Database.Database;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    ({ app, raw } = makeTestApp());
  });
  afterEach(() => raw.close());

  it("returns 404 for unknown task id", async () => {
    const res = await request(app).get("/tasks/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns task when it exists", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "Route test task" });
    const id = created.body.task.id as string;
    const res = await request(app).get(`/tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe("Route test task");
  });
});

describe("POST /tasks", () => {
  let raw: Database.Database;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    ({ app, raw } = makeTestApp());
  });
  afterEach(() => raw.close());

  it("returns 400 when title is missing", async () => {
    const res = await request(app).post("/tasks").send({ workspaceId: "default" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("title is required");
  });

  it("returns 400 for invalid status", async () => {
    const res = await request(app).post("/tasks").send({ title: "T", status: "bad" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid status");
  });

  it("creates task and returns 201 with task object", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "New task" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.task.title).toBe("New task");
    expect(res.body.task.status).toBe("inbox");
  });
});

describe("PATCH /tasks/:id", () => {
  let raw: Database.Database;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    ({ app, raw } = makeTestApp());
  });
  afterEach(() => raw.close());

  it("returns 404 for unknown task id", async () => {
    const res = await request(app)
      .patch("/tasks/00000000-0000-0000-0000-000000000000")
      .send({ status: "done" });
    expect(res.status).toBe(404);
  });

  it("updates task status", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "Update me" });
    const id = created.body.task.id as string;
    const res = await request(app).patch(`/tasks/${id}`).send({ status: "done" });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe("done");
  });

  it("returns 400 for invalid status", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "T" });
    const id = created.body.task.id as string;
    const res = await request(app).patch(`/tasks/${id}`).send({ status: "nope" });
    expect(res.status).toBe(400);
  });

  it("preserves requiredSkills and tags when omitted from patch body", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "T", requiredSkills: ["sql"], tags: ["a", "b"] });
    const id = created.body.task.id as string;
    const res = await request(app).patch(`/tasks/${id}`).send({ status: "in_progress" });
    expect(res.status).toBe(200);
    expect(res.body.task.required_skills).toEqual(["sql"]);
    expect(res.body.task.tags).toEqual(["a", "b"]);
  });

  it("clears tags when explicitly sent as empty array", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "T", tags: ["a", "b"] });
    const id = created.body.task.id as string;
    const res = await request(app).patch(`/tasks/${id}`).send({ tags: [] });
    expect(res.status).toBe(200);
    expect(res.body.task.tags).toEqual([]);
  });
});

describe("DELETE /tasks/:id", () => {
  let raw: Database.Database;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    ({ app, raw } = makeTestApp());
  });
  afterEach(() => raw.close());

  it("returns 404 for unknown task id", async () => {
    const res = await request(app).delete("/tasks/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("deletes existing task and returns ok", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ workspaceId: "default", title: "Delete me" });
    const id = created.body.task.id as string;
    const del = await request(app).delete(`/tasks/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    const get = await request(app).get(`/tasks/${id}`);
    expect(get.status).toBe(404);
  });
});

describe("auth check", () => {
  it("returns 401 when internal key does not match", async () => {
    const { app, raw } = makeTestApp("secret-key");
    const res = await request(app).get("/tasks").set("x-internal-key", "wrong");
    expect(res.status).toBe(401);
    raw.close();
  });

  it("passes through when correct internal key is provided", async () => {
    const { app, raw } = makeTestApp("secret-key");
    const res = await request(app).get("/tasks").set("x-internal-key", "secret-key");
    expect(res.status).toBe(200);
    raw.close();
  });

  it("returns 401 on mutating route when internal key does not match", async () => {
    const { app, raw } = makeTestApp("secret-key");
    const res = await request(app)
      .post("/tasks")
      .set("x-internal-key", "wrong")
      .send({ workspaceId: "default", title: "Should not be created" });
    expect(res.status).toBe(401);
    raw.close();
  });

  it("allows mutating route with correct internal key", async () => {
    const { app, raw } = makeTestApp("secret-key");
    const res = await request(app)
      .post("/tasks")
      .set("x-internal-key", "secret-key")
      .send({ workspaceId: "default", title: "Created with key" });
    expect(res.status).toBe(201);
    raw.close();
  });
});
