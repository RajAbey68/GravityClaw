import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET() {
  const container = await getAppContainer();
  const calls = await container.callCoordinator.listSessions();
  return NextResponse.json({
    elevenLabs: container.elevenLabs.available,
    stt: container.stt.available,
    twilio: container.twilio.available,
    activeCalls: calls.filter((call) => call.state !== "completed" && call.state !== "failed").length
  });
}
