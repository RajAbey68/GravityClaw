import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET() {
  const container = await getAppContainer();
  return NextResponse.json(container.telegram.status);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: "start" | "stop" };
  const container = await getAppContainer();

  if (body.action === "start") {
    container.telegram.start();
  } else if (body.action === "stop") {
    container.telegram.stop();
  }

  return NextResponse.json(container.telegram.status);
}
