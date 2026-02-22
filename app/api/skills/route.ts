import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const agentId = searchParams.get("agentId") ?? "main";
  const includeCode = searchParams.get("includeCode") === "1";
  const skillId = searchParams.get("skillId") ?? undefined;
  const container = await getAppContainer();
  const skills = await container.skills.listSkillsDetailed();
  const bindings = await container.skills.listBindings();
  const workspaceAgents = container.orchestrator.listAgents(workspaceId).map((agent) => agent.id);
  const workspaceScopedAgents = new Set([
    ...workspaceAgents,
    ...workspaceAgents.map((agentId) => `${workspaceId}:${agentId}`)
  ]);
  const activeForAgent = await container.skills.promptsForAgent(`${workspaceId}:${agentId}`);

  if (includeCode && skillId) {
    const code = await container.skills.readSkillCode(skillId);
    if (!code) {
      return NextResponse.json({ error: "skill not found" }, { status: 404 });
    }
    return NextResponse.json({ skillId, code });
  }

  return NextResponse.json({
    skills,
    bindings: bindings.filter((binding) => workspaceScopedAgents.has(binding.agent_id)),
    agentId,
    workspaceId,
    activeForAgent
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "update" | "detach";
    skillId?: string;
    agentId?: string;
    workspaceId?: string;
    enabled?: boolean;
    version?: string;
    prompt?: string;
    scopeDefault?: "shared" | "isolated";
  };

  const container = await getAppContainer();
  const action = body.action ?? "update";

  if (!body.skillId) {
    return NextResponse.json({ error: "skillId is required" }, { status: 400 });
  }

  if (action === "detach") {
    if (!body.agentId) {
      return NextResponse.json({ error: "agentId is required for detach" }, { status: 400 });
    }
    const scopedAgentId = body.agentId.includes(":")
      ? body.agentId
      : `${body.workspaceId ?? "default"}:${body.agentId}`;
    await container.skills.detachSkill({
      agentId: scopedAgentId,
      skillId: body.skillId
    });
    container.docs.record({
      source: "skills",
      detail: `Detached skill '${body.skillId}' from agent '${body.agentId}'.`
    });
    return NextResponse.json({ ok: true });
  }

  const updated = await container.skills.updateSkill({
    skillId: body.skillId,
    enabled: body.enabled,
    version: body.version,
    prompt: body.prompt,
    scopeDefault: body.scopeDefault
  });
  if (!updated) {
    return NextResponse.json({ error: "skill not found" }, { status: 404 });
  }
  container.docs.record({
    source: "skills",
    detail: `Updated skill '${body.skillId}'.`
  });
  return NextResponse.json({ ok: true, skill: updated });
}
