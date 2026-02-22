import { SQLiteMemoryDB } from "@/src/core/memory/db";
import type { ForgeJobSummary, ForgeStage, ForgeStatus } from "@/src/core/types";

interface CreateForgeJobInput {
  id: string;
  trigger: "task-failure" | "missing-capability" | "manual";
  agentId: string;
  capability: string;
  stage: ForgeStage;
  status: ForgeStatus;
  failureReason?: string;
}

function mapJob(row: {
  id: string;
  trigger: "task-failure" | "missing-capability" | "manual";
  agent_id: string;
  capability: string;
  stage: ForgeStage;
  status: ForgeStatus;
  created_at: string;
  updated_at: string;
}): ForgeJobSummary {
  return {
    id: row.id,
    trigger: row.trigger,
    agentId: row.agent_id,
    capability: row.capability,
    stage: row.stage,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ForgeRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async createJob(input: CreateForgeJobInput) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO forge_jobs (id, trigger, agent_id, capability, stage, status, failure_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.trigger,
        input.agentId,
        input.capability,
        input.stage,
        input.status,
        input.failureReason ?? null,
        now,
        now
      ]
    );
  }

  async setJobState(jobId: string, stage: ForgeStage, status: ForgeStatus, failureReason?: string) {
    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE forge_jobs
       SET stage = ?, status = ?, failure_reason = ?, updated_at = ?
       WHERE id = ?`,
      [stage, status, failureReason ?? null, now, jobId]
    );
  }

  async getJob(jobId: string) {
    const row = await this.db.get<{
      id: string;
      trigger: "task-failure" | "missing-capability" | "manual";
      agent_id: string;
      capability: string;
      stage: ForgeStage;
      status: ForgeStatus;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, trigger, agent_id, capability, stage, status, created_at, updated_at
       FROM forge_jobs
       WHERE id = ?`,
      [jobId]
    );
    return row ? mapJob(row) : undefined;
  }

  async listJobs(limit = 60) {
    const rows = await this.db.all<{
      id: string;
      trigger: "task-failure" | "missing-capability" | "manual";
      agent_id: string;
      capability: string;
      stage: ForgeStage;
      status: ForgeStatus;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, trigger, agent_id, capability, stage, status, created_at, updated_at
       FROM forge_jobs
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(mapJob);
  }

  async addArtifact(input: {
    jobId: string;
    artifactType: string;
    path: string;
    sha256: string;
    metadata?: unknown;
  }) {
    await this.db.run(
      `INSERT INTO forge_artifacts (job_id, artifact_type, path, sha256, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.jobId,
        input.artifactType,
        input.path,
        input.sha256,
        input.metadata ? JSON.stringify(input.metadata) : null,
        new Date().toISOString()
      ]
    );
  }

  async listArtifacts(jobId: string) {
    return this.db.all<{
      id: number;
      job_id: string;
      artifact_type: string;
      path: string;
      sha256: string;
      metadata_json: string | null;
      created_at: string;
    }>(
      `SELECT id, job_id, artifact_type, path, sha256, metadata_json, created_at
       FROM forge_artifacts
       WHERE job_id = ?
       ORDER BY id ASC`,
      [jobId]
    );
  }
}
