import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(_request: Request, context: { params: { jobId: string } }) {
  const container = await getAppContainer();
  const artifacts = await container.forge.listArtifacts(context.params.jobId);
  return NextResponse.json({ artifacts });
}

