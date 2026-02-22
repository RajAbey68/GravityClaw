import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = String(value);
  }

  const container = await getAppContainer();
  const result = await container.callCoordinator.onStatusCallback(payload);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}

