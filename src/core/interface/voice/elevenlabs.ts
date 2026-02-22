export class ElevenLabsAdapter {
  constructor(
    private readonly apiKey?: string,
    private readonly defaultVoiceId = "EXAVITQu4vr4xnSDxMaL"
  ) {}

  get available() {
    return Boolean(this.apiKey);
  }

  async synthesize(text: string, voiceId?: string): Promise<Buffer | null> {
    if (!this.apiKey) {
      return null;
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? this.defaultVoiceId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": this.apiKey,
        accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2"
      })
    });

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
