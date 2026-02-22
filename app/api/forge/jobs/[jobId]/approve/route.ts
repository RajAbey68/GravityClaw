import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(_request: Request, context: { params: { jobId: string } }) {
  const container = await getAppContainer();
  try {
    const result = await container.forge.approveJob(context.params.jobId, "main");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}

