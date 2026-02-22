import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(request: Request) {
  const container = await getAppContainer();
  const body = await request.json();

  const { text, voiceId, stability, similarityBoost, agentId } = body;

  if (!text || !voiceId || !agentId) {
    return NextResponse.json(
      { error: "text, voiceId, and agentId are required" },
      { status: 400 }
    );
  }

  try {
    const stream = await container.voice.speak(
      text,
      {
        voiceId,
        stability: stability ?? 0.5,
        similarityBoost: similarityBoost ?? 0.75,
      },
      agentId
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
