import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") || "default";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const container = await getAppContainer();
  try {
    const events = await container.hiveRepo.getLiveFeed(workspaceId, limit);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const container = await getAppContainer();
  const body = await request.json();

  try {
    const event = await container.hiveRepo.recordLiveFeedEvent({
      workspaceId: body.workspaceId || "default",
      hiveId: body.hiveId,
      eventType: body.eventType || "manual.event",
      actorId: body.actorId,
      actorType: body.actorType || "user",
      content: body.content,
      metadata: body.metadata
    });

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
