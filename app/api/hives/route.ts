import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") || "default";

  const container = await getAppContainer();
  try {
    const hives = await container.hiveRepo.listHives(workspaceId);
    return NextResponse.json({ hives });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const container = await getAppContainer();
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const hive = await container.hive.createHive(
      body.workspaceId || "default",
      body.name,
      body.description
    );

    return NextResponse.json({ ok: true, hive });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
