import { getAppContainer } from "@/src/core/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId") ?? "";
  const twiml = [
    `<Response>`,
    `<Gather input="speech" action="/api/voice/twilio/speech?callId=${encodeURIComponent(callId)}" method="POST">`,
    `<Say>Gravity Claw is listening. Please speak your request.</Say>`,
    `</Gather>`,
    `</Response>`
  ].join("");

  return new Response(twiml, {
    status: 200,
    headers: { "content-type": "text/xml" }
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = String(value);
  }

  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");
  if (callId) {
    payload.callId = callId;
  }

  const container = await getAppContainer();
  const result = await container.callCoordinator.onSpeechTurn(payload);
  return new Response(result.twiml, {
    status: result.ok ? 200 : 404,
    headers: { "content-type": "text/xml" }
  });
}

