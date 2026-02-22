import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(
  _request: Request,
  context: { params: { convId: string } }
) {
  const container = await getAppContainer();
  const conversation = await container.conversations.get(context.params.convId);
  if (!conversation) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

export async function PATCH(
  request: Request,
  context: { params: { convId: string } }
) {
  const body = (await request.json()) as {
    title?: string | null;
  };
  const container = await getAppContainer();
  const updated = await container.conversations.updateTitle(context.params.convId, body.title ?? null);
  if (!updated) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: { convId: string } }
) {
  const container = await getAppContainer();
  const removed = await container.conversations.delete(context.params.convId);
  if (!removed) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
