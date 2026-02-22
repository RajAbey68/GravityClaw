import fs from "node:fs";
import path from "node:path";

function now() {
  return new Date().toISOString();
}

function ensureFile(filePath: string, fallback: string) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fallback, "utf8");
  }
}

function appendLine(filePath: string, line: string) {
  const content = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${content.trimEnd()}\n${line}\n`, "utf8");
}

export class DocSyncService {
  private readonly devlogPath = path.resolve(process.cwd(), "DEVLOG.md");
  private readonly contextPath = path.resolve(process.cwd(), "GRAVITY_CONTEXT.md");

  constructor() {
    ensureFile(this.devlogPath, "# DEVLOG\n");
    ensureFile(this.contextPath, "# GRAVITY_CONTEXT\n");
  }

  record(change: { source: string; detail: string }) {
    const stamp = now();
    appendLine(this.devlogPath, `- ${stamp} [${change.source}] ${change.detail}`);
    this.updateContext(change, stamp);
  }

  private updateContext(change: { source: string; detail: string }, stamp: string) {
    const existing = fs.readFileSync(this.contextPath, "utf8");
    const marker = "## Automated Updates";
    const line = `- ${stamp} [${change.source}] ${change.detail}`;

    if (!existing.includes(marker)) {
      fs.writeFileSync(
        this.contextPath,
        `${existing.trimEnd()}\n\n${marker}\n${line}\n`,
        "utf8"
      );
      return;
    }

    const [head, tail] = existing.split(marker);
    const lines = tail
      .trim()
      .split("\n")
      .filter((entry) => entry.trim().startsWith("- "))
      .slice(0, 99);

    fs.writeFileSync(
      this.contextPath,
      `${head.trimEnd()}\n\n${marker}\n${line}\n${lines.join("\n")}\n`,
      "utf8"
    );
  }
}

