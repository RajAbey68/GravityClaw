import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { AuditRepository } from "@/src/core/memory/repositories/audit";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

function nowIso() {
  return new Date().toISOString();
}

function toSafeSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70) || "change";
}

function simpleUnifiedDiff(filePath: string, before: string, after: string) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const lines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`
  ];

  for (let i = 0; i < max; i += 1) {
    const oldLine = beforeLines[i];
    const nextLine = afterLines[i];
    if (oldLine === nextLine) {
      if (oldLine !== undefined) {
        lines.push(` ${oldLine}`);
      }
      continue;
    }
    if (oldLine !== undefined) {
      lines.push(`-${oldLine}`);
    }
    if (nextLine !== undefined) {
      lines.push(`+${nextLine}`);
    }
  }

  return lines.join("\n") + "\n";
}

export class AuditService {
  private readonly diffRoot = path.resolve(process.cwd(), "data", "audit-diffs");

  constructor(
    private readonly repository: AuditRepository,
    private readonly eventBus: SystemEventBus
  ) {
    fs.mkdirSync(this.diffRoot, { recursive: true });
  }

  async recordFileWrite(input: {
    action: string;
    targetPath: string;
    content: string;
    summary: string;
    actorType?: string;
    actorId?: string;
  }) {
    const timestamp = nowIso();
    const targetAbsolutePath = path.resolve(process.cwd(), input.targetPath);
    const targetDir = path.dirname(targetAbsolutePath);
    fs.mkdirSync(targetDir, { recursive: true });

    const before = fs.existsSync(targetAbsolutePath)
      ? fs.readFileSync(targetAbsolutePath, "utf8")
      : "";
    fs.writeFileSync(targetAbsolutePath, input.content, "utf8");

    const diffContent = simpleUnifiedDiff(input.targetPath, before, input.content);
    const diffName = `${timestamp.replace(/[:.]/g, "-")}-${toSafeSlug(input.targetPath)}.diff`;
    const diffAbsolutePath = path.join(this.diffRoot, diffName);
    fs.writeFileSync(diffAbsolutePath, diffContent, "utf8");

    const relativeDiffPath = path.relative(process.cwd(), diffAbsolutePath).replace(/\\/g, "/");
    const previousHash = await this.repository.latestHash();
    const currHash = crypto
      .createHash("sha256")
      .update(`${previousHash ?? ""}|${input.action}|${input.targetPath}|${timestamp}|${input.content}`)
      .digest("hex");

    await this.repository.addLog({
      action: input.action,
      actorType: input.actorType ?? "system",
      actorId: input.actorId,
      targetPath: input.targetPath,
      diffPath: relativeDiffPath,
      summary: input.summary,
      prevHash: previousHash,
      currHash
    });

    publishEvent(this.eventBus, {
      type: "audit.log",
      action: input.action,
      target: input.targetPath,
      diffPath: relativeDiffPath,
      actorAgentId: input.actorId
    });

    return { diffPath: relativeDiffPath, currHash };
  }
}

