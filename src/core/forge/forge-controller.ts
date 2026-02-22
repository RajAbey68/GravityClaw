import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import type { ForgeStage, ForgeStatus } from "@/src/core/types";
import { ForgeRepository } from "@/src/core/memory/repositories/forge";
import { ToolRegistry } from "@/src/core/tools/registry";
import { createGeneratedTool, type GeneratedToolManifest } from "@/src/core/tools/generated-tool";
import { runSandboxedJavascript } from "@/src/core/tools/sandbox";
import { AuditService } from "@/src/core/audit/audit-service";
import { DocSyncService } from "@/src/core/docs/doc-sync-service";

const ALLOWLISTED_RESEARCH_HOSTS = new Set([
  "docs.openclaw.ai",
  "platform.openai.com",
  "docs.anthropic.com",
  "ai.google.dev"
]);

function now() {
  return new Date().toISOString();
}

function toSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42) || "generated";
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function inferRiskFromCapability(capability: string): "safe" | "elevated" | "dangerous" {
  const lower = capability.toLowerCase();
  if (/\b(delete|shell|exec|system|filesystem|sudo)\b/.test(lower)) {
    return "dangerous";
  }
  if (/\b(write|modify|update|call|request|api)\b/.test(lower)) {
    return "elevated";
  }
  return "safe";
}

export class ForgeController {
  private readonly forgeRoot = path.resolve(process.cwd(), "data", "forge", "jobs");
  private readonly promotedRoot = path.resolve(process.cwd(), "data", "generated-tools");

  constructor(
    private readonly eventBus: SystemEventBus,
    private readonly enabled: boolean,
    private readonly repository: ForgeRepository,
    private readonly tools: ToolRegistry,
    private readonly audit: AuditService,
    private readonly docs: DocSyncService
  ) {
    fs.mkdirSync(this.forgeRoot, { recursive: true });
    fs.mkdirSync(this.promotedRoot, { recursive: true });
  }

  get status() {
    return { enabled: this.enabled };
  }

  async init() {
    const manifests = fs.existsSync(this.promotedRoot)
      ? fs
          .readdirSync(this.promotedRoot)
          .filter((entry) => entry.endsWith(".json"))
          .sort()
      : [];

    for (const manifestFile of manifests) {
      try {
        const absolute = path.join(this.promotedRoot, manifestFile);
        const manifest = JSON.parse(fs.readFileSync(absolute, "utf8")) as GeneratedToolManifest;
        if (!this.tools.has(manifest.id)) {
          this.tools.register(createGeneratedTool(manifest));
        }
      } catch {
        // Keep startup resilient.
      }
    }
  }

  async listJobs() {
    return this.repository.listJobs();
  }

  async listArtifacts(jobId: string) {
    return this.repository.listArtifacts(jobId);
  }

  async createManualJob(input: { agentId: string; capability: string; trigger?: "task-failure" | "missing-capability" | "manual" }) {
    const capability = input.capability.trim();
    if (!capability) {
      throw new Error("capability is required");
    }

    const jobId = randomUUID();
    await this.repository.createJob({
      id: jobId,
      trigger: input.trigger ?? "manual",
      agentId: input.agentId,
      capability,
      stage: "analyze",
      status: "queued"
    });

    publishEvent(this.eventBus, {
      type: "forge.job",
      jobId,
      stage: "analyze",
      status: "queued",
      capability,
      agentId: input.agentId
    });
    publishEvent(this.eventBus, {
      type: "forge.stage.changed",
      jobId,
      stage: "analyze",
      status: "queued",
      capability,
      agentId: input.agentId
    });

    if (!this.enabled) {
      await this.repository.setJobState(jobId, "analyze", "failed", "forge-disabled");
      publishEvent(this.eventBus, {
        type: "forge.job",
        jobId,
        stage: "analyze",
        status: "failed",
        capability,
        agentId: input.agentId
      });
      publishEvent(this.eventBus, {
        type: "forge.stage.changed",
        jobId,
        stage: "analyze",
        status: "failed",
        capability,
        agentId: input.agentId
      });
      return { jobId, status: "failed", reason: "forge-disabled" as const };
    }

    await this.processJob(jobId).catch(async (error) => {
      await this.repository.setJobState(jobId, "logged", "failed", (error as Error).message);
      publishEvent(this.eventBus, {
        type: "forge.job",
        jobId,
        stage: "logged",
        status: "failed",
        capability,
        agentId: input.agentId
      });
      publishEvent(this.eventBus, {
        type: "forge.stage.changed",
        jobId,
        stage: "logged",
        status: "failed",
        capability,
        agentId: input.agentId
      });
    });

    return { jobId, status: "queued" as const };
  }

  async maybeCreateFromFailure(input: { agentId: string; message: string; failure: string }) {
    if (!this.enabled) return undefined;
    const capability = this.extractCapability(input.message, input.failure);
    return this.createManualJob({
      agentId: input.agentId,
      capability,
      trigger: /missing|tool-not-found|unknown/i.test(input.failure) ? "missing-capability" : "task-failure"
    });
  }

  async approveJob(jobId: string, actorAgentId?: string) {
    const job = await this.repository.getJob(jobId);
    if (!job) {
      throw new Error("forge-job-not-found");
    }
    if (job.status !== "awaiting_approval") {
      throw new Error(`forge-job-not-awaiting-approval (${job.status})`);
    }

    await this.transition(jobId, job.capability, job.agentId, "register", "running");
    publishEvent(this.eventBus, {
      type: "forge.approval",
      jobId,
      action: "approved"
    });

    const artifacts = await this.repository.listArtifacts(jobId);
    const manifestArtifact = artifacts.find((artifact) => artifact.artifact_type === "manifest:formalized");
    if (!manifestArtifact) {
      await this.transition(jobId, job.capability, job.agentId, "logged", "failed");
      throw new Error("formalized-manifest-not-found");
    }

    const manifestAbsolutePath = path.resolve(process.cwd(), manifestArtifact.path);
    const manifest = JSON.parse(fs.readFileSync(manifestAbsolutePath, "utf8")) as GeneratedToolManifest;
    if (!this.tools.has(manifest.id)) {
      this.tools.register(createGeneratedTool(manifest));
    }

    await this.transition(jobId, job.capability, job.agentId, "logged", "completed");
    this.docs.record({
      source: "forge",
      detail: `Approved and registered generated tool '${manifest.id}' from job ${jobId}.`
    });
    await this.audit.recordFileWrite({
      action: "forge-approval",
      targetPath: "DEVLOG.md",
      content: fs.readFileSync(path.resolve(process.cwd(), "DEVLOG.md"), "utf8"),
      summary: `Forge approval recorded for ${manifest.id}`,
      actorType: "agent",
      actorId: actorAgentId
    });

    return { ok: true, toolId: manifest.id, jobId };
  }

  async rejectJob(jobId: string, reason: string, actorAgentId?: string) {
    const job = await this.repository.getJob(jobId);
    if (!job) {
      throw new Error("forge-job-not-found");
    }
    await this.repository.setJobState(jobId, job.stage, "rejected", reason || "rejected");
    publishEvent(this.eventBus, {
      type: "forge.approval",
      jobId,
      action: "rejected"
    });
    publishEvent(this.eventBus, {
      type: "forge.job",
      jobId,
      stage: job.stage,
      status: "rejected",
      capability: job.capability,
      agentId: job.agentId
    });
    publishEvent(this.eventBus, {
      type: "forge.stage.changed",
      jobId,
      stage: job.stage,
      status: "rejected",
      capability: job.capability,
      agentId: job.agentId
    });

    this.docs.record({
      source: "forge",
      detail: `Rejected forge job ${jobId} (${reason || "no reason provided"}).`
    });
    await this.audit.recordFileWrite({
      action: "forge-rejection",
      targetPath: "DEVLOG.md",
      content: fs.readFileSync(path.resolve(process.cwd(), "DEVLOG.md"), "utf8"),
      summary: `Forge rejection recorded for ${jobId}`,
      actorType: "agent",
      actorId: actorAgentId
    });

    return { ok: true, jobId };
  }

  private async processJob(jobId: string) {
    const job = await this.repository.getJob(jobId);
    if (!job) {
      throw new Error("forge-job-not-found");
    }

    const jobRoot = path.join(this.forgeRoot, job.id);
    fs.mkdirSync(jobRoot, { recursive: true });

    await this.transition(job.id, job.capability, job.agentId, "analyze", "running");
    const analysis = `Forge Analysis\n- capability: ${job.capability}\n- trigger: ${job.trigger}\n- generated_at: ${now()}\n`;
    await this.writeArtifact(job.id, "analysis", path.join(jobRoot, "analysis.md"), analysis, {
      capability: job.capability
    });

    await this.transition(job.id, job.capability, job.agentId, "research", "running");
    const research = await this.research(job.capability);
    await this.writeArtifact(job.id, "research", path.join(jobRoot, "research.md"), research, {
      hosts: [...ALLOWLISTED_RESEARCH_HOSTS]
    });

    await this.transition(job.id, job.capability, job.agentId, "generate", "running");
    const manifest = this.generateManifest(job.id, job.capability);
    const protoToolCode = this.generatePrototypeToolSource(manifest);
    const protoTestCode = this.generatePrototypeTestSource(manifest);
    await this.writeArtifact(job.id, "manifest:proto", path.join(jobRoot, "manifest.proto.json"), JSON.stringify(manifest, null, 2), manifest);
    await this.writeArtifact(job.id, "code:proto", path.join(jobRoot, "tool.proto.ts"), protoToolCode, { id: manifest.id });
    await this.writeArtifact(job.id, "test:proto", path.join(jobRoot, "tool.proto.test.ts"), protoTestCode, { id: manifest.id });

    await this.transition(job.id, job.capability, job.agentId, "sandbox-test", "running");
    this.runSandboxValidation(manifest);

    await this.transition(job.id, job.capability, job.agentId, "formalize", "running");
    const promotedManifestPath = path.join(this.promotedRoot, `${manifest.id}.json`);
    await this.audit.recordFileWrite({
      action: "forge-formalize-manifest",
      targetPath: path.relative(process.cwd(), promotedManifestPath).replace(/\\/g, "/"),
      content: JSON.stringify(manifest, null, 2) + "\n",
      summary: `Forge formalized manifest for ${manifest.id}`,
      actorType: "agent",
      actorId: job.agentId
    });
    await this.repository.addArtifact({
      jobId: job.id,
      artifactType: "manifest:formalized",
      path: path.relative(process.cwd(), promotedManifestPath).replace(/\\/g, "/"),
      sha256: sha256(JSON.stringify(manifest)),
      metadata: manifest
    });

    const promotedSourcePath = path.join(this.promotedRoot, `${manifest.id}.tool.ts`);
    await this.audit.recordFileWrite({
      action: "forge-formalize-source",
      targetPath: path.relative(process.cwd(), promotedSourcePath).replace(/\\/g, "/"),
      content: protoToolCode,
      summary: `Forge formalized source for ${manifest.id}`,
      actorType: "agent",
      actorId: job.agentId
    });
    await this.repository.addArtifact({
      jobId: job.id,
      artifactType: "code:formalized",
      path: path.relative(process.cwd(), promotedSourcePath).replace(/\\/g, "/"),
      sha256: sha256(protoToolCode),
      metadata: { id: manifest.id }
    });

    await this.transition(job.id, job.capability, job.agentId, "formalize", "awaiting_approval");
    publishEvent(this.eventBus, {
      type: "forge.approval",
      jobId: job.id,
      action: "requested"
    });
  }

  private async writeArtifact(
    jobId: string,
    artifactType: string,
    absolutePath: string,
    content: string,
    metadata?: unknown
  ) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
    await this.repository.addArtifact({
      jobId,
      artifactType,
      path: path.relative(process.cwd(), absolutePath).replace(/\\/g, "/"),
      sha256: sha256(content),
      metadata
    });
  }

  private async research(capability: string) {
    const references: string[] = [];
    const localPaths = [
      path.resolve(process.cwd(), "features to add.md"),
      path.resolve(process.cwd(), "instruction.md"),
      path.resolve(process.cwd(), "docs", "architecture.md"),
      path.resolve(process.cwd(), "docs", "security.md")
    ];
    for (const localPath of localPaths) {
      if (!fs.existsSync(localPath)) continue;
      const text = fs.readFileSync(localPath, "utf8").slice(0, 1800);
      references.push(`## ${path.relative(process.cwd(), localPath).replace(/\\/g, "/")}\n${text}`);
    }

    const remote = await this.fetchAllowlisted(
      `https://docs.openclaw.ai/search?q=${encodeURIComponent(capability)}`
    );
    if (remote) {
      references.push(`## docs.openclaw.ai (allowlisted excerpt)\n${remote.slice(0, 1000)}`);
    }

    return [
      `Forge Research`,
      `Capability: ${capability}`,
      `Timestamp: ${now()}`,
      ...references
    ].join("\n\n");
  }

  private async fetchAllowlisted(url: string) {
    try {
      const parsed = new URL(url);
      if (!ALLOWLISTED_RESEARCH_HOSTS.has(parsed.hostname)) {
        return "";
      }
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        return "";
      }
      const text = await response.text();
      return text.slice(0, 2000);
    } catch {
      return "";
    }
  }

  private runSandboxValidation(manifest: GeneratedToolManifest) {
    const script = `
      const blocked = ["require(", "process.", "child_process", "fs.", "net."];
      const manifest = inputManifest;
      const serialized = JSON.stringify(manifest);
      const hasBlocked = blocked.some((token) => serialized.includes(token));
      if (hasBlocked) {
        throw new Error("manifest-contains-blocked-token");
      }
      if (!manifest.id || !manifest.description || !manifest.responseTemplate) {
        throw new Error("manifest-missing-required-field");
      }
      "sandbox-pass";
    `;

    const result = runSandboxedJavascript<string>(script, { inputManifest: manifest }, 300);
    if (result !== "sandbox-pass") {
      throw new Error("sandbox-validation-failed");
    }
  }

  private generateManifest(jobId: string, capability: string): GeneratedToolManifest {
    const slug = toSlug(capability);
    const id = `forge-${slug}-${jobId.slice(0, 8)}`;
    return {
      id,
      description: `Forge-generated capability tool for: ${capability}`,
      risk: inferRiskFromCapability(capability),
      capability,
      responseTemplate: `Capability "${capability}" executed at {{timestamp}} with input:\n{{input}}`,
      version: "1.0.0"
    };
  }

  private generatePrototypeToolSource(manifest: GeneratedToolManifest) {
    return [
      `// Generated by Gravity Claw Forge`,
      `// Tool ID: ${manifest.id}`,
      `export const manifest = ${JSON.stringify(manifest, null, 2)};`,
      `export default manifest;`,
      ``
    ].join("\n");
  }

  private generatePrototypeTestSource(manifest: GeneratedToolManifest) {
    return [
      `import manifest from "./tool.proto";`,
      ``,
      `if (!manifest.id || !manifest.responseTemplate) {`,
      `  throw new Error("invalid generated manifest for ${manifest.id}");`,
      `}`,
      ``
    ].join("\n");
  }

  private async transition(
    jobId: string,
    capability: string,
    agentId: string,
    stage: ForgeStage,
    status: ForgeStatus,
    failureReason?: string
  ) {
    await this.repository.setJobState(jobId, stage, status, failureReason);
    publishEvent(this.eventBus, {
      type: "forge.job",
      jobId,
      stage,
      status,
      capability,
      agentId
    });
    publishEvent(this.eventBus, {
      type: "forge.stage.changed",
      jobId,
      stage,
      status,
      capability,
      agentId
    });
  }

  private extractCapability(message: string, failure: string) {
    const lower = message.trim();
    if (lower.length > 0) {
      return lower.split(/\s+/).slice(0, 12).join(" ");
    }
    return `recover-from-${toSlug(failure)}`;
  }
}
