import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST() {
  const container = await getAppContainer();
  const results = await container.proactive.runCycle("manual");
  return NextResponse.json({ ok: true, results });
}

