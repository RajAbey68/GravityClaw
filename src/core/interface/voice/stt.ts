export class SpeechToTextAdapter {
  constructor(private readonly openaiApiKey?: string) {}

  get available() {
    return Boolean(this.openaiApiKey);
  }

  async transcribeTelegramVoice(botToken: string, fileId: string): Promise<string | null> {
    if (!this.openaiApiKey) {
      return null;
    }

    const fileMetaResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileMeta = (await fileMetaResponse.json()) as {
      ok: boolean;
      result?: { file_path?: string };
    };

    const filePath = fileMeta.result?.file_path;
    if (!fileMeta.ok || !filePath) {
      return null;
    }

    const audioResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!audioResponse.ok) {
      return null;
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const formData = new FormData();
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" }), "voice.ogg");

    const transcription = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.openaiApiKey}`
      },
      body: formData
    });

    if (!transcription.ok) {
      return null;
    }

    const payload = (await transcription.json()) as { text?: string };
    return payload.text?.trim() ?? null;
  }
}
