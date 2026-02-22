import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request, context: { params: { taskId: string } }) {
  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;

  const container = await getAppContainer();
  const task = await container.mission.getTask(context.params.taskId);
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const events = await container.mission.listTaskEvents(context.params.taskId, limit);
  return NextResponse.json({ task, events });
}