import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(request: Request, context: { params: { jobId: string } }) {
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const container = await getAppContainer();

  try {
    const result = await container.forge.rejectJob(
      context.params.jobId,
      body.reason?.trim() || "rejected",
      "main"
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}

