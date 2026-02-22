import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "default";
  const limit = Number(searchParams.get("limit") ?? 60);
  const container = await getAppContainer();
  const rooms = await container.collaboration.listRooms(Number.isFinite(limit) ? limit : 60);
  return NextResponse.json({
    rooms: rooms.filter((room) => room.id.startsWith(`${workspaceId}:`) || room.id.startsWith("home-") || room.id.startsWith("group-"))
  });
}

