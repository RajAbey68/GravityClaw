import { NextRequest, NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob;
    const agentId = formData.get("agentId") as string || "default";

    if (!audio) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const container = await getAppContainer();
    const buffer = Buffer.from(await audio.arrayBuffer());
    
    // Use centralized VoiceManager
    const text = await container.voice.transcribe(buffer, agentId);

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Transcription route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
