import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import type { AuditService } from "@/src/core/audit/audit-service";

const MAX_READ_BYTES = 10 * 1024 * 1024;
const MAX_WRITE_BYTES = 5 * 1024 * 1024;

interface FilePathInput {
  path: string;
}

interface WriteFileInput {
  path: string;
  content: string;
}

interface MoveFileInput {
  from: string;
  to: string;
}

interface SearchFilesInput {
  path?: string;
  query: string;
  max_results?: number;
}

interface ListDirInput {
  path?: string;
  includeHidden?: boolean;
}

interface AllowedPathContext {
  workspaceRoot: string;
  allowedRoots: string[];
}

function normalizeSlashes(value: string) {
  return value.replace(/\\/g, "/");
}

function isInsideRoot(candidate: string, root: string) {
  const normalizedCandidate = normalizeSlashes(path.resolve(candidate));
  const normalizedRoot = normalizeSlashes(path.resolve(root));
  return normalizedCandidate.startsWith(normalizedRoot);
}

async function resolveAllowedPath(inputPath: string, context: AllowedPathContext) {
  const cleaned = inputPath.trim();
  if (!cleaned) {
    throw new Error("path is required");
  }
  const absolute = path.isAbsolute(cleaned)
    ? path.resolve(cleaned)
    : path.resolve(context.workspaceRoot, cleaned);

  // Resolve symlinks and .. to get final physical path
  let real: string;
  try {
    // If it doesn't exist, we resolve parent to check if it CAN exist inside root
    const exists = await fs
      .access(absolute)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      real = await fs.realpath(absolute);
    } else {
      const parentReal = await fs.realpath(path.dirname(absolute));
      real = path.join(parentReal, path.basename(absolute));
    }
  } catch (error) {
    // Fallback if realpath fails (e.g. missing permission on parent)
    real = path.resolve(absolute);
  }

  const allowed = context.allowedRoots.some((root) => isInsideRoot(real, root));
  if (!allowed) {
    throw new Error("path is outside allowed roots");
  }
  return real;
}

async function isBinaryFile(absolutePath: string) {
  const file = await fs.open(absolutePath, "r");
  try {
    const stat = await file.stat();
    const sampleBytes = Math.min(4096, stat.size);
    const buffer = Buffer.alloc(sampleBytes);
    await file.read(buffer, 0, sampleBytes, 0);
    return buffer.includes(0);
  } finally {
    await file.close();
  }
}

async function walkFiles(root: string, collector: string[], maxResults: number) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (collector.length >= maxResults) {
      return;
    }
    const nextPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(nextPath, collector, maxResults);
      continue;
    }
    collector.push(nextPath);
  }
}

function relativeToWorkspace(absolutePath: string, workspaceRoot: string) {
  return normalizeSlashes(path.relative(workspaceRoot, absolutePath));
}

async function auditedWrite(
  audit: AuditService | undefined,
  workspaceRoot: string,
  absolutePath: string,
  content: string,
  action: string
) {
  if (!audit) {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
    return;
  }
  await audit.recordFileWrite({
    action,
    targetPath: relativeToWorkspace(absolutePath, workspaceRoot),
    content,
    summary: `${action} ${relativeToWorkspace(absolutePath, workspaceRoot)}`,
    actorType: "agent",
    actorId: "tool:file-ops"
  });
}

function ensureWriteSize(content: string) {
  if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
    throw new Error("write size exceeds 5MB limit");
  }
}

export function createFileOpsTools(params?: {
  workspaceRoot?: string;
  allowedRoots?: string[];
  audit?: AuditService;
}): Array<ToolDefinition<any, any>> {
  const workspaceRoot = path.resolve(params?.workspaceRoot ?? process.cwd());
  const allowedRoots = (params?.allowedRoots ?? [workspaceRoot, path.resolve(workspaceRoot, "data")]).map(
    (item) => path.resolve(item)
  );
  const context: AllowedPathContext = { workspaceRoot, allowedRoots };
  const audit = params?.audit;

  const readFileTool: ToolDefinition<FilePathInput, { path: string; content: string; bytes: number }> = {
    id: "read_file",
    description: "Read a UTF-8 text file within allowed workspace roots.",
    risk: "safe",
    async execute(input: FilePathInput, _ctx: ToolExecutionContext) {
      const absolutePath = await resolveAllowedPath(input.path, context);
      const stat = await fs.stat(absolutePath);
      if (stat.size > MAX_READ_BYTES) {
        throw new Error("file exceeds 10MB read limit");
      }
      if (await isBinaryFile(absolutePath)) {
        throw new Error("binary files are not supported");
      }
      const content = await fs.readFile(absolutePath, "utf8");
      return {
        path: relativeToWorkspace(absolutePath, workspaceRoot),
        content,
        bytes: Buffer.byteLength(content, "utf8")
      };
    }
  };

  const writeFileTool: ToolDefinition<WriteFileInput, { path: string; bytes: number }> = {
    id: "write_file",
    description: "Write text content to an existing or new file under allowed roots.",
    risk: "dangerous",
    async execute(input: WriteFileInput, _ctx: ToolExecutionContext) {
      const absolutePath = await resolveAllowedPath(input.path, context);
      const content = input.content ?? "";
      ensureWriteSize(content);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await auditedWrite(audit, workspaceRoot, absolutePath, content, "tool.write_file");
      return {
        path: relativeToWorkspace(absolutePath, workspaceRoot),
        bytes: Buffer.byteLength(content, "utf8")
      };
    }
  };

  const createFileTool: ToolDefinition<WriteFileInput, { path: string; created: true }> = {
    id: "create_file",
    description: "Create a new text file (fails if file already exists).",
    risk: "dangerous",
    async execute(input: WriteFileInput, _ctx: ToolExecutionContext) {
      const absolutePath = await resolveAllowedPath(input.path, context);
      const exists = await fs
        .access(absolutePath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        throw new Error("file already exists");
      }
      const content = input.content ?? "";
      ensureWriteSize(content);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await auditedWrite(audit, workspaceRoot, absolutePath, content, "tool.create_file");
      return {
        path: relativeToWorkspace(absolutePath, workspaceRoot),
        created: true
      };
    }
  };

  const deleteFileTool: ToolDefinition<FilePathInput, { path: string; deleted: true }> = {
    id: "delete_file",
    description: "Delete a file under allowed roots with audit trail.",
    risk: "dangerous",
    async execute(input: FilePathInput, _ctx: ToolExecutionContext) {
      const absolutePath = await resolveAllowedPath(input.path, context);
      await auditedWrite(audit, workspaceRoot, absolutePath, "", "tool.delete_file");
      await fs.rm(absolutePath, { force: true });
      return {
        path: relativeToWorkspace(absolutePath, workspaceRoot),
        deleted: true
      };
    }
  };

  const listDirTool: ToolDefinition<ListDirInput, { path: string; entries: Array<{ name: string; type: string }> }> =
    {
      id: "list_dir",
      description: "List files/directories for a path under allowed roots.",
      risk: "safe",
      async execute(input: ListDirInput, _ctx: ToolExecutionContext) {
        const absolutePath = await resolveAllowedPath(input.path ?? ".", context);
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        return {
          path: relativeToWorkspace(absolutePath, workspaceRoot),
          entries: entries
            .filter((entry) => input.includeHidden || !entry.name.startsWith("."))
            .map((entry) => ({
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file"
            }))
        };
      }
    };

  const searchFilesTool: ToolDefinition<SearchFilesInput, { matches: Array<{ path: string }> }> = {
    id: "search_files",
    description: "Search file paths by substring within an allowed root.",
    risk: "safe",
    async execute(input: SearchFilesInput, _ctx: ToolExecutionContext) {
      const query = input.query?.trim().toLowerCase();
      if (!query) {
        throw new Error("query is required");
      }
      const targetRoot = await resolveAllowedPath(input.path ?? ".", context);
      const maxResults = Math.max(1, Math.min(input.max_results ?? 40, 400));
      const files: string[] = [];
      await walkFiles(targetRoot, files, maxResults * 4);
      const matches = files
        .filter((filePath) => normalizeSlashes(filePath).toLowerCase().includes(query))
        .slice(0, maxResults)
        .map((filePath) => ({
          path: relativeToWorkspace(filePath, workspaceRoot)
        }));
      return { matches };
    }
  };

  const moveFileTool: ToolDefinition<MoveFileInput, { from: string; to: string; moved: true }> = {
    id: "move_file",
    description: "Move/rename a file under allowed roots.",
    risk: "dangerous",
    async execute(input: MoveFileInput, _ctx: ToolExecutionContext) {
      const fromAbsolute = resolveAllowedPath(input.from, context);
      const toAbsolute = resolveAllowedPath(input.to, context);
      const content = await fs.readFile(fromAbsolute, "utf8");
      ensureWriteSize(content);
      await fs.mkdir(path.dirname(toAbsolute), { recursive: true });
      await auditedWrite(audit, workspaceRoot, toAbsolute, content, "tool.move_file.target");
      await auditedWrite(audit, workspaceRoot, fromAbsolute, "", "tool.move_file.source-delete");
      await fs.rm(fromAbsolute, { force: true });
      return {
        from: relativeToWorkspace(fromAbsolute, workspaceRoot),
        to: relativeToWorkspace(toAbsolute, workspaceRoot),
        moved: true
      };
    }
  };

  const copyFileTool: ToolDefinition<MoveFileInput, { from: string; to: string; copied: true }> = {
    id: "copy_file",
    description: "Copy a file under allowed roots.",
    risk: "dangerous",
    async execute(input: MoveFileInput, _ctx: ToolExecutionContext) {
      const fromAbsolute = resolveAllowedPath(input.from, context);
      const toAbsolute = resolveAllowedPath(input.to, context);
      const content = await fs.readFile(fromAbsolute, "utf8");
      ensureWriteSize(content);
      await fs.mkdir(path.dirname(toAbsolute), { recursive: true });
      await auditedWrite(audit, workspaceRoot, toAbsolute, content, "tool.copy_file");
      return {
        from: relativeToWorkspace(fromAbsolute, workspaceRoot),
        to: relativeToWorkspace(toAbsolute, workspaceRoot),
        copied: true
      };
    }
  };

  return [
    readFileTool,
    writeFileTool,
    createFileTool,
    deleteFileTool,
    listDirTool,
    searchFilesTool,
    moveFileTool,
    copyFileTool
  ];
}
