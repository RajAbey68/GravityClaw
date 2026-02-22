import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const container = await getAppContainer();
  const id = params.id;

  try {
    const hive = await container.hiveRepo.getHive(id);
    if (!hive) {
      return NextResponse.json({ error: "Hive not found" }, { status: 404 });
    }

    const members = await container.hiveRepo.listSwarmMembers(id);
    return NextResponse.json({ hive, members });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const container = await getAppContainer();
  const id = params.id;
  const body = await request.json();

  const action = body.action || "broadcast";

  try {
    if (action === "add-member") {
      if (!body.agentId) {
        return NextResponse.json({ error: "agentId is required" }, { status: 400 });
      }
      const member = await container.hive.addAgentToHive(id, body.agentId, body.role);
      return NextResponse.json({ ok: true, member });
    }

    if (action === "broadcast") {
      if (!body.message) {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
      }
      await container.hive.broadcastToHive(id, body.message, body.sourceAgentId);
      return NextResponse.json({ ok: true });
    }

    if (action === "run-task") {
      if (!body.goal) {
        return NextResponse.json({ error: "goal is required" }, { status: 400 });
      }
      // This uses the SwarmEngine for collective task execution
      const result = await container.swarm.decomposeAndExecute(id, body.goal, body.workspaceId || "default");
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
