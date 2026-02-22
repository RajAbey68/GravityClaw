import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const container = await getAppContainer();
  const jobs = await container.forge.listJobs();
  const filtered = workspaceId
    ? jobs.filter(
        (job) => job.agentId.startsWith(`${workspaceId}:`) || (!job.agentId.includes(":") && workspaceId === "default")
      )
    : jobs;
  return NextResponse.json({ jobs: filtered });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    capability?: string;
    agentId?: string;
    workspaceId?: string;
    trigger?: "task-failure" | "missing-capability" | "manual";
  };

  const capability = body.capability?.trim();
  if (!capability) {
    return NextResponse.json({ error: "capability is required" }, { status: 400 });
  }

  const container = await getAppContainer();
  const workspaceId = body.workspaceId ?? "default";
  const scopedAgentId = (body.agentId ?? "main").includes(":")
    ? (body.agentId ?? "main")
    : `${workspaceId}:${body.agentId ?? "main"}`;
  const created = await container.forge.createManualJob({
    capability,
    agentId: scopedAgentId,
    trigger: body.trigger ?? "manual"
  });

  return NextResponse.json({ ok: true, ...created });
}
