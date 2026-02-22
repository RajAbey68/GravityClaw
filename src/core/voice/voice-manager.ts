import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { AgentDescriptor } from "@/src/core/types";

export interface VoiceConfig {
  voiceId: string;
  stability: number;
  similarityBoost: number;
}

export class VoiceManager {
  private readonly elevenLabsApiKey: string;
  private readonly whisperApiKey: string;

  constructor(private readonly eventBus: SystemEventBus) {
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || "";
    this.whisperApiKey = process.env.OPENAI_API_KEY || "";
  }

  async transcribe(audioBuffer: Buffer, agentId: string): Promise<string> {
    if (!this.whisperApiKey) {
      throw new Error("Whisper transcription requires OPENAI_API_KEY");
    }

    // In a real implementation, we would send the buffer to OpenAI or a local Whisper instance
    // For now, we'll implement a robust mock or a basic fetch if possible
    try {
      // Mocking transcription for the skeleton
      const text = "Hello, I am testing the voice system.";
      
      this.eventBus.publish({
        type: "transcription.completed",
        agentId,
        text,
        timestamp: new Date().toISOString()
      });

      return text;
    } catch (error) {
      console.error("Transcription failed:", error);
      throw error;
    }
  }

  async speak(text: string, voiceConfig: VoiceConfig, agentId: string): Promise<ReadableStream> {
    if (!this.elevenLabsApiKey) {
      throw new Error("Voice synthesis requires ELEVENLABS_API_KEY");
    }

    this.eventBus.publish({
      type: "voice.started",
      agentId,
      text,
      voiceId: voiceConfig.voiceId,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: voiceConfig.stability,
            similarity_boost: voiceConfig.similarityBoost,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ElevenLabs API error: ${JSON.stringify(error)}`);
    }

    return response.body!;
  }
}
