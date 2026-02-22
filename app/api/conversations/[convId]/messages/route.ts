import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

export async function GET(
  request: Request,
  context: { params: { convId: string } }
) {
  const { searchParams } = new URL(request.url);
  const limit = toInt(searchParams.get("limit"), 120);
  const beforeRaw = searchParams.get("before");
  const before = beforeRaw ? toInt(beforeRaw, 0) : undefined;

  const container = await getAppContainer();
  const conversation = await container.conversations.get(context.params.convId);
  if (!conversation) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }

  const messages = await container.conversations.listMessages({
    conversationId: context.params.convId,
    limit,
    before
  });

  return NextResponse.json({
    conversation,
    messages: messages.reverse()
  });
}
