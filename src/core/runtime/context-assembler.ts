import fs from "node:fs";
import path from "node:path";
import { SessionRepository } from "@/src/core/memory/repositories/sessions";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";

interface SoulCache {
  mtimeMs: number;
  content: string;
}

let soulCache: SoulCache | undefined;

function parseSoulSections(raw: string) {
  const sections = new Map<string, string[]>();
  const lines = raw.split("\n");
  let current = "root";
  sections.set(current, []);

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) {
        sections.set(current, []);
      }
      continue;
    }

    sections.get(current)?.push(line);
  }

  return sections;
}

function loadSoulMarkdown() {
  const soulPath = path.resolve(process.cwd(), "SOUL.md");
  if (!fs.existsSync(soulPath)) {
    return "You are Gravity Claw, a local-first autonomous AI operating system assistant.";
  }

  const stat = fs.statSync(soulPath);
  if (soulCache && soulCache.mtimeMs === stat.mtimeMs) {
    return soulCache.content;
  }

  const raw = fs.readFileSync(soulPath, "utf8");
  const parsed = parseSoulSections(raw);
  const orderedKeys = [
    "persona",
    "behavioral constraints",
    "ethical boundaries",
    "communication style",
    "delegation rules",
    "proactivity rules",
    "sub-agent spawning policies"
  ];

  const ordered = orderedKeys
    .map((key) => {
      const content = parsed.get(key)?.join("\n").trim();
      if (!content) return "";
      return `## ${key}\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");

  soulCache = {
    mtimeMs: stat.mtimeMs,
    content: ordered || raw
  };

  return soulCache.content;
}

export class ContextAssembler {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly memories: MemoryRepository
  ) {}

  async assemble(
    sessionKey: string,
    userMessage: string,
    options: {
      workspaceId: string;
      shortTermNamespace?: string;
      longTermNamespaces?: string[];
      agentId?: string;
      roomContext?: string;
      skillPrompts?: Array<{ id: string; prompt: string }>;
      systemPromptOverride?: string;
      soulOverride?: string;
    }
  ) {
    const normalized = {
      workspaceId: options.workspaceId,
      shortTermNamespace: options.shortTermNamespace ?? "main",
      longTermNamespaces: options.longTermNamespaces ?? ["main"],
      agentId: options.agentId ?? "main",
      roomContext: options.roomContext ?? "",
      skillPrompts: options.skillPrompts ?? [],
      systemPromptOverride: options.systemPromptOverride ?? "",
      soulOverride: options.soulOverride ?? ""
    };

    const soul = normalized.soulOverride?.trim() || loadSoulMarkdown();
    const shortTerm = await this.sessions.recentMessages(sessionKey, 14);
    const longTerm = await this.memories.retrieveContext({
      workspaceId: normalized.workspaceId,
      query: userMessage,
      shortTermNamespace: normalized.shortTermNamespace,
      longTermNamespaces: normalized.longTermNamespaces,
      limit: 10
    });

    if (shortTerm.length > 12) {
      await this.memories.compressNamespace(normalized.workspaceId, normalized.shortTermNamespace, 20);
    }

    const recalled = longTerm
      .map((entry) => `- [${entry.namespace}/${entry.kind}] ${entry.content}`)
      .join("\n");

    const skillBlock = normalized.skillPrompts.length
      ? normalized.skillPrompts
          .map((entry) => `### Skill: ${entry.id}\n${entry.prompt}`)
          .join("\n\n")
      : "No runtime skills active.";

    const roomBlock = normalized.roomContext?.trim()
      ? normalized.roomContext.trim()
      : "No room context.";

    const overrideBlock = normalized.systemPromptOverride?.trim()
      ? `Agent override:\n${normalized.systemPromptOverride.trim()}`
      : "Agent override: none";

    return {
      systemPrompt: `${soul}\n\n${overrideBlock}\n\nRoom context:\n${roomBlock}\n\nActive runtime skills:\n${skillBlock}\n\nRelevant memory snippets:\n${recalled || "- none"}`,
      messages: [
        ...shortTerm.reverse().map((message) => ({
          role: message.role as "user" | "assistant" | "system",
          content: message.content
        })),
        { role: "user" as const, content: userMessage }
      ],
      memoryCount: longTerm.length
    };
  }
}
