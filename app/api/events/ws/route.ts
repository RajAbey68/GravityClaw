import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "WebSocket endpoint is available at /api/events/ws via HTTP upgrade."
  });
}
