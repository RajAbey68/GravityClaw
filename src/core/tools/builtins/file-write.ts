import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";

interface FileWriteInput {
  relativePath: string;
  content: string;
}

interface FileWriteOutput {
  ok: true;
  absolutePath: string;
  bytesWritten: number;
}

function resolveSafePath(relativePath: string, baseDir: string) {
  const cleaned = relativePath.replace(/\\/g, "/").replace(/\.\./g, "");
  const absolute = path.resolve(baseDir, cleaned);
  if (!absolute.startsWith(path.resolve(baseDir))) {
    throw new Error("invalid path outside sandbox");
  }
  return absolute;
}

export function createFileWriteTool(sandboxDir = "data/tool-sandbox"): ToolDefinition<FileWriteInput, FileWriteOutput> {
  const baseDir = path.resolve(process.cwd(), sandboxDir);

  return {
    id: "file-write",
    description: "Write content into the local tool sandbox directory.",
    risk: "dangerous",
    async execute(input: FileWriteInput, _ctx: ToolExecutionContext) {
      const absolutePath = resolveSafePath(input.relativePath, baseDir);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      const content = input.content ?? "";
      await fs.writeFile(absolutePath, content, "utf8");
      return {
        ok: true,
        absolutePath,
        bytesWritten: Buffer.byteLength(content, "utf8")
      };
    }
  };
}
