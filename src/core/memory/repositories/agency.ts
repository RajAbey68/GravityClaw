import { SQLiteMemoryDB } from "@/src/core/memory/db";

export interface AgencyWorkspace {
  id: string;
  name: string;
  description?: string;
  mission: string;
  status: "active" | "paused" | "archived";
  orchestrator_agent_id?: string;
  parent_workspace_id?: string;
  created_at: number;
  updated_at: number;
  config?: string;
}

export interface TeamWorkspace {
  id: string;
  agency_workspace_id: string;
  name: string;
  specialty: string;
  lead_agent_id?: string;
  member_limit: number;
  status: "active" | "paused" | "archived";
  created_at: number;
  updated_at: number;
  config?: string;
}

export interface TeamMember {
  id: string;
  team_workspace_id: string;
  agent_id: string;
  role: string;
  specialty_tags?: string;
  joined_at: number;
  status: "active" | "inactive";
}

export interface TeamMessage {
  id: string;
  team_workspace_id: string;
  sender_agent_id: string;
  content: string;
  message_type: "chat" | "task" | "result" | "status";
  reply_to_id?: string;
  metadata?: string;
  created_at: number;
}

export interface AgencyTask {
  id: string;
  agency_workspace_id: string;
  assigned_team_id?: string;
  assigned_agent_id?: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "review" | "done" | "failed";
  priority: "low" | "medium" | "high" | "critical";
  parent_task_id?: string;
  deliverables?: string;
  result?: string;
  started_at?: number;
  completed_at?: number;
  created_at: number;
  updated_at: number;
}

export interface TeamSharedFile {
  id: string;
  team_workspace_id: string;
  filename: string;
  file_path: string;
  uploaded_by_agent_id: string;
  file_type?: string;
  size_bytes?: number;
  description?: string;
  created_at: number;
  updated_at: number;
}

export class AgencyRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  // ─── Agency Workspaces ───────────────────────────────────────────────────

  async createAgency(agency: AgencyWorkspace): Promise<void> {
    await this.db.run(
      `INSERT INTO agency_workspaces (id, name, description, mission, status, orchestrator_agent_id, parent_workspace_id, created_at, updated_at, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agency.id,
        agency.name,
        agency.description ?? null,
        agency.mission,
        agency.status,
        agency.orchestrator_agent_id ?? null,
        agency.parent_workspace_id ?? null,
        agency.created_at,
        agency.updated_at,
        agency.config ?? null
      ]
    );
  }

  async listAgencies(): Promise<AgencyWorkspace[]> {
    return this.db.all<AgencyWorkspace>(
      `SELECT * FROM agency_workspaces WHERE status != 'archived' ORDER BY updated_at DESC`
    );
  }

  async getAgency(id: string): Promise<AgencyWorkspace | null> {
    return (
      (await this.db.get<AgencyWorkspace>(`SELECT * FROM agency_workspaces WHERE id = ?`, [id])) ?? null
    );
  }

  async updateAgency(id: string, fields: Partial<AgencyWorkspace>): Promise<void> {
    const now = Date.now();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { sets.push("name = ?"); values.push(fields.name); }
    if (fields.description !== undefined) { sets.push("description = ?"); values.push(fields.description); }
    if (fields.mission !== undefined) { sets.push("mission = ?"); values.push(fields.mission); }
    if (fields.status !== undefined) { sets.push("status = ?"); values.push(fields.status); }
    if (fields.orchestrator_agent_id !== undefined) { sets.push("orchestrator_agent_id = ?"); values.push(fields.orchestrator_agent_id); }
    if (fields.config !== undefined) { sets.push("config = ?"); values.push(fields.config); }

    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);

    if (sets.length > 1) {
      await this.db.run(`UPDATE agency_workspaces SET ${sets.join(", ")} WHERE id = ?`, values);
    }
  }

  async deleteAgency(id: string): Promise<void> {
    await this.db.run(`UPDATE agency_workspaces SET status = 'archived', updated_at = ? WHERE id = ?`, [
      Date.now(),
      id
    ]);
  }

  // ─── Team Workspaces ─────────────────────────────────────────────────────

  async createTeam(team: TeamWorkspace): Promise<void> {
    await this.db.run(
      `INSERT INTO team_workspaces (id, agency_workspace_id, name, specialty, lead_agent_id, member_limit, status, created_at, updated_at, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        team.id,
        team.agency_workspace_id,
        team.name,
        team.specialty,
        team.lead_agent_id ?? null,
        team.member_limit,
        team.status,
        team.created_at,
        team.updated_at,
        team.config ?? null
      ]
    );
  }

  async listTeams(agencyWorkspaceId: string): Promise<TeamWorkspace[]> {
    return this.db.all<TeamWorkspace>(
      `SELECT * FROM team_workspaces WHERE agency_workspace_id = ? AND status != 'archived' ORDER BY created_at ASC`,
      [agencyWorkspaceId]
    );
  }

  async getTeam(id: string): Promise<TeamWorkspace | null> {
    return (
      (await this.db.get<TeamWorkspace>(`SELECT * FROM team_workspaces WHERE id = ?`, [id])) ?? null
    );
  }

  async updateTeam(id: string, fields: Partial<TeamWorkspace>): Promise<void> {
    const now = Date.now();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { sets.push("name = ?"); values.push(fields.name); }
    if (fields.specialty !== undefined) { sets.push("specialty = ?"); values.push(fields.specialty); }
    if (fields.lead_agent_id !== undefined) { sets.push("lead_agent_id = ?"); values.push(fields.lead_agent_id); }
    if (fields.status !== undefined) { sets.push("status = ?"); values.push(fields.status); }
    if (fields.config !== undefined) { sets.push("config = ?"); values.push(fields.config); }

    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);

    if (sets.length > 1) {
      await this.db.run(`UPDATE team_workspaces SET ${sets.join(", ")} WHERE id = ?`, values);
    }
  }

  // ─── Team Members ────────────────────────────────────────────────────────

  async addTeamMember(member: TeamMember): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO team_members (id, team_workspace_id, agent_id, role, specialty_tags, joined_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.team_workspace_id,
        member.agent_id,
        member.role,
        member.specialty_tags ?? null,
        member.joined_at,
        member.status
      ]
    );
  }

  async listTeamMembers(teamWorkspaceId: string): Promise<TeamMember[]> {
    return this.db.all<TeamMember>(
      `SELECT * FROM team_members WHERE team_workspace_id = ? AND status = 'active'`,
      [teamWorkspaceId]
    );
  }

  async removeTeamMember(teamWorkspaceId: string, agentId: string): Promise<void> {
    await this.db.run(
      `UPDATE team_members SET status = 'inactive' WHERE team_workspace_id = ? AND agent_id = ?`,
      [teamWorkspaceId, agentId]
    );
  }

  // ─── Team Messages ───────────────────────────────────────────────────────

  async addTeamMessage(message: TeamMessage): Promise<void> {
    await this.db.run(
      `INSERT INTO team_messages (id, team_workspace_id, sender_agent_id, content, message_type, reply_to_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.team_workspace_id,
        message.sender_agent_id,
        message.content,
        message.message_type,
        message.reply_to_id ?? null,
        message.metadata ?? null,
        message.created_at
      ]
    );
  }

  async listTeamMessages(teamWorkspaceId: string, limit = 100): Promise<TeamMessage[]> {
    return this.db.all<TeamMessage>(
      `SELECT * FROM team_messages WHERE team_workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
      [teamWorkspaceId, limit]
    );
  }

  async getUnreadMessages(teamWorkspaceId: string, agentId: string, since: number): Promise<TeamMessage[]> {
    return this.db.all<TeamMessage>(
      `SELECT * FROM team_messages
       WHERE team_workspace_id = ?
         AND sender_agent_id != ?
         AND created_at > ?
       ORDER BY created_at ASC`,
      [teamWorkspaceId, agentId, since]
    );
  }

  // ─── Agency Tasks ────────────────────────────────────────────────────────

  async createTask(task: AgencyTask): Promise<void> {
    await this.db.run(
      `INSERT INTO agency_tasks (id, agency_workspace_id, assigned_team_id, assigned_agent_id, title, description, status, priority, parent_task_id, deliverables, result, started_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.agency_workspace_id,
        task.assigned_team_id ?? null,
        task.assigned_agent_id ?? null,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.parent_task_id ?? null,
        task.deliverables ?? null,
        task.result ?? null,
        task.started_at ?? null,
        task.completed_at ?? null,
        task.created_at,
        task.updated_at
      ]
    );
  }

  async listTasks(agencyWorkspaceId: string): Promise<AgencyTask[]> {
    return this.db.all<AgencyTask>(
      `SELECT * FROM agency_tasks WHERE agency_workspace_id = ? ORDER BY created_at DESC`,
      [agencyWorkspaceId]
    );
  }

  async getTask(id: string): Promise<AgencyTask | null> {
    return (
      (await this.db.get<AgencyTask>(`SELECT * FROM agency_tasks WHERE id = ?`, [id])) ?? null
    );
  }

  async updateTask(id: string, fields: Partial<AgencyTask>): Promise<void> {
    const now = Date.now();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.status !== undefined) { sets.push("status = ?"); values.push(fields.status); }
    if (fields.assigned_team_id !== undefined) { sets.push("assigned_team_id = ?"); values.push(fields.assigned_team_id); }
    if (fields.assigned_agent_id !== undefined) { sets.push("assigned_agent_id = ?"); values.push(fields.assigned_agent_id); }
    if (fields.result !== undefined) { sets.push("result = ?"); values.push(fields.result); }
    if (fields.deliverables !== undefined) { sets.push("deliverables = ?"); values.push(fields.deliverables); }
    if (fields.started_at !== undefined) { sets.push("started_at = ?"); values.push(fields.started_at); }
    if (fields.completed_at !== undefined) { sets.push("completed_at = ?"); values.push(fields.completed_at); }
    if (fields.priority !== undefined) { sets.push("priority = ?"); values.push(fields.priority); }

    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);

    if (sets.length > 1) {
      await this.db.run(`UPDATE agency_tasks SET ${sets.join(", ")} WHERE id = ?`, values);
    }
  }

  // ─── Team Shared Files ───────────────────────────────────────────────────

  async addSharedFile(file: TeamSharedFile): Promise<void> {
    await this.db.run(
      `INSERT INTO team_shared_files (id, team_workspace_id, filename, file_path, uploaded_by_agent_id, file_type, size_bytes, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.id,
        file.team_workspace_id,
        file.filename,
        file.file_path,
        file.uploaded_by_agent_id,
        file.file_type ?? null,
        file.size_bytes ?? null,
        file.description ?? null,
        file.created_at,
        file.updated_at
      ]
    );
  }

  async listSharedFiles(teamWorkspaceId: string): Promise<TeamSharedFile[]> {
    return this.db.all<TeamSharedFile>(
      `SELECT * FROM team_shared_files WHERE team_workspace_id = ? ORDER BY created_at DESC`,
      [teamWorkspaceId]
    );
  }

  // ─── Live Feed Events ────────────────────────────────────────────────────

  async addFeedEvent(event: {
    id: string;
    workspace_id: string;
    agent_id: string;
    agent_name: string;
    event_type: string;
    icon: string;
    title: string;
    detail?: string;
    metadata?: string;
    level: "info" | "warn" | "error" | "success";
    group_id?: string;
    created_at: number;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO live_feed_events (id, workspace_id, agent_id, agent_name, event_type, icon, title, detail, metadata, level, group_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.workspace_id,
        event.agent_id,
        event.agent_name,
        event.event_type,
        event.icon,
        event.title,
        event.detail ?? null,
        event.metadata ?? null,
        event.level,
        event.group_id ?? null,
        event.created_at
      ]
    );
  }

  async listFeedEvents(options: {
    workspaceId?: string;
    agentId?: string;
    limit?: number;
    since?: number;
  }): Promise<
    Array<{
      id: string;
      workspace_id: string;
      agent_id: string;
      agent_name: string;
      event_type: string;
      icon: string;
      title: string;
      detail: string | null;
      metadata: string | null;
      level: string;
      group_id: string | null;
      created_at: number;
    }>
  > {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.workspaceId) {
      conditions.push("workspace_id = ?");
      values.push(options.workspaceId);
    }
    if (options.agentId) {
      conditions.push("agent_id = ?");
      values.push(options.agentId);
    }
    if (options.since) {
      conditions.push("created_at > ?");
      values.push(options.since);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit ?? 200;
    values.push(limit);

    return this.db.all(
      `SELECT * FROM live_feed_events ${where} ORDER BY created_at DESC LIMIT ?`,
      values
    );
  }

  async pruneFeedEvents(keepCount = 10000): Promise<void> {
    await this.db.run(
      `DELETE FROM live_feed_events WHERE id IN (
        SELECT id FROM live_feed_events ORDER BY created_at DESC LIMIT -1 OFFSET ?
      )`,
      [keepCount]
    );
  }
}
