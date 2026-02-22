import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    agentId?: string;
    skillId?: string;
    mode?: "shared" | "isolated";
    workspaceId?: string;
  };

  if (!body.agentId || !body.skillId) {
    return NextResponse.json({ error: "agentId and skillId are required" }, { status: 400 });
  }

  const mode = body.mode === "isolated" ? "isolated" : "shared";
  const container = await getAppContainer();
  const scopedAgentId = `${body.workspaceId ?? "default"}:${body.agentId}`;

  try {
    const result = await container.skills.attachSkill({
      agentId: scopedAgentId,
      skillId: body.skillId,
      mode
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}
