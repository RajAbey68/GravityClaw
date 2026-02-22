import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

const SECTION_ORDER = [
  "persona",
  "behavioral constraints",
  "ethical boundaries",
  "communication style",
  "delegation rules",
  "proactivity rules",
  "sub-agent spawning policies"
] as const;

type SoulSection = (typeof SECTION_ORDER)[number];

function parseSoul(raw: string) {
  const sections = new Map<string, string[]>();
  let current = "";
  for (const line of raw.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) {
        sections.set(current, []);
      }
      continue;
    }
    if (!current) continue;
    sections.get(current)?.push(line);
  }

  return Object.fromEntries(
    SECTION_ORDER.map((key) => [key, (sections.get(key)?.join("\n") ?? "").trim()])
  ) as Record<SoulSection, string>;
}

function buildSoulContent(sections: Record<SoulSection, string>) {
  const parts = ["# SOUL", ""];
  for (const key of SECTION_ORDER) {
    parts.push(`## ${key}`);
    parts.push((sections[key] ?? "").trim() || "Not configured.");
    parts.push("");
  }
  return parts.join("\n").trim() + "\n";
}

export async function GET() {
  const soulPath = path.resolve(process.cwd(), "SOUL.md");
  const raw = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, "utf8") : "# SOUL\n";
  const sections = parseSoul(raw);
  return NextResponse.json({
    id: "default",
    name: "Default SOUL Profile",
    sections,
    raw
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sections?: Partial<Record<SoulSection, string>>;
  };
  if (!body.sections || typeof body.sections !== "object") {
    return NextResponse.json({ error: "sections are required" }, { status: 400 });
  }

  const soulPath = path.resolve(process.cwd(), "SOUL.md");
  const currentRaw = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, "utf8") : "# SOUL\n";
  const currentSections = parseSoul(currentRaw);
  const nextSections = { ...currentSections };
  for (const key of SECTION_ORDER) {
    const value = body.sections[key];
    if (typeof value === "string") {
      nextSections[key] = value;
    }
  }

  const nextRaw = buildSoulContent(nextSections);
  const container = await getAppContainer();
  await container.audit.recordFileWrite({
    action: "profile.soul.update",
    targetPath: "SOUL.md",
    content: nextRaw,
    summary: "Updated SOUL profile from Profiles UI",
    actorType: "user"
  });
  container.docs.record({
    source: "profiles",
    detail: "Updated SOUL profile sections."
  });

  return NextResponse.json({
    ok: true,
    sections: nextSections
  });
}

