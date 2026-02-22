import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(request: Request, context: { params: { callId: string } }) {
  const body = (await request.json()) as { toAgentId?: string };
  const toAgentId = body.toAgentId?.trim();
  if (!toAgentId) {
    return NextResponse.json({ error: "toAgentId is required" }, { status: 400 });
  }

  const container = await getAppContainer();
  try {
    const result = await container.callCoordinator.handoff(context.params.callId, toAgentId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}

