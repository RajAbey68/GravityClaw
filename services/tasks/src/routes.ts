/**
 * Express route handlers for the tasks service.
 * Mirrors the shape of app/api/mission/tasks/route.ts exactly.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import type { TasksRepository } from "./repository.js";

type MissionStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type MissionPriority = "low" | "medium" | "high" | "critical";

const statusValues = new Set<MissionStatus>(["inbox", "assigned", "in_progress", "review", "done"]);
const priorityValues = new Set<MissionPriority>(["low", "medium", "high", "critical"]);

function parseArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Wrap an async handler so errors are forwarded to Express error middleware. */
function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

export function createTasksRouter(repo: TasksRepository, internalKey: string | undefined): Router {
  const router = Router();

  /** Validate internal service key if configured. */
  function checkAuth(req: Request, res: Response): boolean {
    if (!internalKey) return true;
    if (req.headers["x-internal-key"] === internalKey) return true;
    res.status(401).json({ error: "unauthorized" });
    return false;
  }

  /** GET /tasks */
  router.get("/tasks", wrapAsync(async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const workspaceId = (req.query["workspaceId"] as string | undefined)?.trim() || "default";
    const statusParam = (req.query["status"] as string | undefined)?.trim() as MissionStatus | undefined;
    const agentId = (req.query["agentId"] as string | undefined)?.trim() || undefined;
    const limitRaw = Number(req.query["limit"] ?? "120");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 120;

    if (statusParam && !statusValues.has(statusParam)) {
      res.status(400).json({ error: "invalid status" });
      return;
    }

    const tasks = await repo.listTasks({ workspaceId, status: statusParam, agentId, limit });
    res.json({ tasks });
  }));

  /** GET /tasks/:id */
  router.get("/tasks/:id", wrapAsync(async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const task = await repo.getTask(req.params["id"]!);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json({ task });
  }));

  /** POST /tasks */
  router.post("/tasks", wrapAsync(async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const body = req.body as {
      workspaceId?: string;
      title?: string;
      description?: string;
      status?: MissionStatus;
      priority?: MissionPriority;
      assignedAgentId?: string;
      requiredSkills?: unknown;
      tags?: unknown;
      deliverables?: unknown;
    };

    const workspaceId = body.workspaceId?.trim() || "default";
    const title = body.title?.trim() || "";
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (body.status && !statusValues.has(body.status)) {
      res.status(400).json({ error: "invalid status" });
      return;
    }
    if (body.priority && !priorityValues.has(body.priority)) {
      res.status(400).json({ error: "invalid priority" });
      return;
    }

    const created = await repo.createTask({
      workspaceId,
      title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assignedAgentId: body.assignedAgentId?.trim() || undefined,
      requiredSkills: parseArray(body.requiredSkills),
      tags: parseArray(body.tags),
      deliverables: Array.isArray(body.deliverables)
        ? (body.deliverables as Array<Record<string, unknown>>).filter(
            (item): item is Record<string, unknown> => typeof item === "object" && item !== null
          )
        : undefined,
    });

    if (!created) {
      res.status(500).json({ error: "failed to create task" });
      return;
    }
    res.status(201).json({ ok: true, task: created });
  }));

  /** PATCH /tasks/:id */
  router.patch("/tasks/:id", wrapAsync(async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const body = req.body as {
      title?: string;
      description?: string;
      status?: MissionStatus;
      priority?: MissionPriority;
      assignedAgentId?: string | null;
      requiredSkills?: unknown;
      tags?: unknown;
      deliverables?: unknown;
    };

    if (body.status && !statusValues.has(body.status)) {
      res.status(400).json({ error: "invalid status" });
      return;
    }
    if (body.priority && !priorityValues.has(body.priority)) {
      res.status(400).json({ error: "invalid priority" });
      return;
    }

    // Only forward array fields when explicitly present in the request body.
    // Passing undefined preserves existing values in the repository; passing
    // parseArray(undefined) → [] would silently clear them on status-only patches.
    const updated = await repo.updateTask(req.params["id"]!, {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assignedAgentId: body.assignedAgentId,
      requiredSkills: "requiredSkills" in body ? parseArray(body.requiredSkills) : undefined,
      tags: "tags" in body ? parseArray(body.tags) : undefined,
      deliverables: Array.isArray(body.deliverables)
        ? (body.deliverables as Array<Record<string, unknown>>).filter(
            (item): item is Record<string, unknown> => typeof item === "object" && item !== null
          )
        : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json({ ok: true, task: updated });
  }));

  /** DELETE /tasks/:id */
  router.delete("/tasks/:id", wrapAsync(async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const deleted = await repo.deleteTask(req.params["id"]!);
    if (!deleted) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
