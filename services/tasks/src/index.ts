/**
 * GravityClaw Tasks Service
 *
 * Standalone Express service that owns the mission_tasks SQLite table.
 * The monolith proxies /api/mission/tasks/* here when TASKS_SERVICE_URL is set.
 *
 * Environment variables:
 *   DATABASE_PATH      Path to SQLite file (default: /data/gravity-claw.sqlite)
 *   PORT               HTTP port (default: 3001)
 *   INTERNAL_SERVICE_KEY  If set, all requests must carry x-internal-key header
 */
import express, { type Request, type Response, type NextFunction } from "express";
import { openDb } from "./db.js";
import { TasksRepository } from "./repository.js";
import { createTasksRouter } from "./routes.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const DB_PATH = process.env["DATABASE_PATH"] ?? "/data/gravity-claw.sqlite";
const INTERNAL_KEY = process.env["INTERNAL_SERVICE_KEY"];

const db = openDb(DB_PATH);
const repo = new TasksRepository(db);

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tasks", db: DB_PATH });
});

app.use("/", createTasksRouter(repo, INTERNAL_KEY));

/** Terminal error middleware — must have 4 params so Express treats it as an error handler. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[tasks-service] unhandled error", err);
  res.status(500).json({ error: "internal server error" });
});

// Guard: skip listen when imported by tests (supertest binds its own port).
if (process.env["NODE_ENV"] !== "test") {
  app.listen(PORT, () => {
    console.log(`[tasks-service] listening on :${PORT}, db=${DB_PATH}`);
  });
}

export { app };
