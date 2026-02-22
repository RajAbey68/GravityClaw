import fs from "node:fs";
import path from "node:path";
import { SkillRepository } from "@/src/core/memory/repositories/skills";

interface FilesystemSkill {
  id: string;
  sourcePath: string;
  version: string;
  prompt: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export class SkillService {
  private readonly runtimeSkillRoot = path.resolve(process.cwd(), "skills", "runtime");
  private readonly isolatedRoot = path.resolve(process.cwd(), "data", "skills", "agents");

  constructor(private readonly repository: SkillRepository) {
    fs.mkdirSync(this.isolatedRoot, { recursive: true });
  }

  async syncFromFilesystem() {
    if (!fs.existsSync(this.runtimeSkillRoot)) {
      return [];
    }

    const entries = fs
      .readdirSync(this.runtimeSkillRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const loaded: FilesystemSkill[] = [];
    for (const name of entries) {
      const dir = path.join(this.runtimeSkillRoot, name);
      const metaPath = path.join(dir, "skill.json");
      const promptPath = path.join(dir, "prompt.md");

      if (!fs.existsSync(metaPath) || !fs.existsSync(promptPath)) {
        continue;
      }

      const meta = readJson<{ name: string; version?: string }>(metaPath);
      const id = (meta.name ?? name).trim();
      if (!id) continue;

      const prompt = fs.readFileSync(promptPath, "utf8").trim();
      const sourcePath = path.relative(process.cwd(), dir).replace(/\\/g, "/");
      const skill: FilesystemSkill = {
        id,
        sourcePath,
        version: meta.version ?? "0.0.1",
        prompt
      };
      loaded.push(skill);

      await this.repository.upsertSkill({
        id: skill.id,
        sourcePath: skill.sourcePath,
        version: skill.version,
        enabled: true,
        scopeDefault: "shared",
        prompt: skill.prompt
      });
    }

    return loaded;
  }

  async listSkills() {
    return this.listSkillsDetailed();
  }

  async listSkillsDetailed() {
    const skills = await this.repository.listSkills(true);
    const bindings = await this.repository.listBindings();
    const skillToAgents = new Map<string, string[]>();
    for (const binding of bindings) {
      const list = skillToAgents.get(binding.skill_id) ?? [];
      list.push(binding.agent_id);
      skillToAgents.set(binding.skill_id, list);
    }

    return skills.map((skill) => {
      const meta = this.loadMetaFromSource(skill.source_path);
      return {
        id: skill.id,
        sourcePath: skill.source_path,
        codePath: `${skill.source_path}/prompt.md`,
        version: skill.version,
        enabled: skill.enabled === 1,
        scopeDefault: skill.scope_default,
        description: meta.description,
        dependencies: meta.dependencies,
        assignedAgents: skillToAgents.get(skill.id) ?? []
      };
    });
  }

  async attachSkill(input: { agentId: string; skillId: string; mode: "shared" | "isolated" }) {
    const skill = await this.repository.getSkill(input.skillId);
    if (!skill || skill.enabled !== 1) {
      throw new Error(`Skill '${input.skillId}' not found or disabled.`);
    }

    if (input.mode === "shared") {
      await this.repository.bindSkill({
        agentId: input.agentId,
        skillId: input.skillId,
        mode: "shared"
      });
      return { mode: "shared" as const };
    }

    const isolatedDir = path.join(this.isolatedRoot, input.agentId, input.skillId);
    fs.mkdirSync(isolatedDir, { recursive: true });
    const isolatedPath = path.join(isolatedDir, "prompt.md");
    fs.writeFileSync(isolatedPath, skill.prompt, "utf8");
    const isolatedCopyPath = path.relative(process.cwd(), isolatedPath).replace(/\\/g, "/");

    await this.repository.bindSkill({
      agentId: input.agentId,
      skillId: input.skillId,
      mode: "isolated",
      isolatedCopyPath
    });

    return { mode: "isolated" as const, isolatedCopyPath };
  }

  async detachSkill(input: { agentId: string; skillId: string }) {
    await this.repository.removeBinding(input.agentId, input.skillId);
  }

  async updateSkill(input: {
    skillId: string;
    enabled?: boolean;
    version?: string;
    prompt?: string;
    scopeDefault?: "shared" | "isolated";
  }) {
    return this.repository.updateSkill(input.skillId, {
      enabled: input.enabled,
      version: input.version,
      prompt: input.prompt,
      scopeDefault: input.scopeDefault
    });
  }

  async readSkillCode(skillId: string) {
    const skill = await this.repository.getSkill(skillId);
    if (!skill) return undefined;
    const promptPath = path.resolve(process.cwd(), skill.source_path, "prompt.md");
    if (!fs.existsSync(promptPath)) {
      return {
        path: path.relative(process.cwd(), promptPath).replace(/\\/g, "/"),
        content: skill.prompt
      };
    }

    return {
      path: path.relative(process.cwd(), promptPath).replace(/\\/g, "/"),
      content: fs.readFileSync(promptPath, "utf8")
    };
  }

  async promptsForAgent(agentId: string) {
    const base = (await this.repository.listSkills()).filter((skill) => skill.enabled === 1);
    const bindings = await this.repository.listBindings(agentId);

    if (bindings.length === 0) {
      return base
        .filter((skill) => skill.scope_default === "shared")
        .map((skill) => ({ id: skill.id, prompt: skill.prompt }));
    }

    const boundMap = new Map(bindings.map((binding) => [binding.skill_id, binding]));
    const prompts: Array<{ id: string; prompt: string }> = [];

    for (const skill of base) {
      const binding = boundMap.get(skill.id);
      if (!binding) {
        if (skill.scope_default === "shared") {
          prompts.push({ id: skill.id, prompt: skill.prompt });
        }
        continue;
      }

      if (binding.mode === "isolated" && binding.isolated_copy_path) {
        const isolatedPath = path.resolve(process.cwd(), binding.isolated_copy_path);
        const isolatedPrompt = fs.existsSync(isolatedPath)
          ? fs.readFileSync(isolatedPath, "utf8")
          : skill.prompt;
        prompts.push({ id: skill.id, prompt: isolatedPrompt });
      } else {
        prompts.push({ id: skill.id, prompt: skill.prompt });
      }
    }

    return prompts;
  }

  async listBindings() {
    return this.repository.listBindings();
  }

  private loadMetaFromSource(sourcePath: string) {
    const metaPath = path.resolve(process.cwd(), sourcePath, "skill.json");
    if (!fs.existsSync(metaPath)) {
      return {
        description: "",
        dependencies: [] as string[]
      };
    }

    try {
      const meta = readJson<{
        description?: string;
        dependencies?: string[];
      }>(metaPath);
      return {
        description: meta.description ?? "",
        dependencies: meta.dependencies ?? []
      };
    } catch {
      return {
        description: "",
        dependencies: [] as string[]
      };
    }
  }
}
