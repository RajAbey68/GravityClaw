import { Orchestrator } from "@/src/core/orchestrator/orchestrator";
import { ElevenLabsAdapter } from "@/src/core/interface/voice/elevenlabs";
import { SpeechToTextAdapter } from "@/src/core/interface/voice/stt";
import { isTelegramUserAllowed } from "@/src/core/interface/telegram/whitelist";
import { publishEvent } from "@/src/core/interface/websocket/publisher";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

interface TelegramPollParams {
  botToken?: string;
  pollIntervalMs: number;
  allowedUsers: Set<string>;
  orchestrator: Orchestrator;
  eventBus: SystemEventBus;
  elevenLabs: ElevenLabsAdapter;
  stt: SpeechToTextAdapter;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    voice?: { file_id?: string };
    chat?: { id?: number };
    from?: { id?: number };
  };
}

export class TelegramPollingClient {
  private running = false;
  private offset = 0;

  constructor(private readonly params: TelegramPollParams) {}

  get status() {
    return {
      running: this.running,
      enabled: Boolean(this.params.botToken),
      offset: this.offset
    };
  }

  start() {
    if (!this.params.botToken || this.running) {
      return;
    }
    this.running = true;
    this.loop();
    publishEvent(this.params.eventBus, {
      type: "system.info",
      detail: "Telegram long polling started"
    });
  }

  stop() {
    this.running = false;
    publishEvent(this.params.eventBus, {
      type: "system.info",
      detail: "Telegram long polling stopped"
    });
  }

  private async loop() {
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        publishEvent(this.params.eventBus, {
          type: "system.info",
          detail: `Telegram polling error: ${(error as Error).message}`
        });
      }

      await new Promise((resolve) => setTimeout(resolve, this.params.pollIntervalMs));
    }
  }

  private async getUpdates() {
    const response = await fetch(
      `https://api.telegram.org/bot${this.params.botToken}/getUpdates?timeout=20&offset=${this.offset}`
    );
    const payload = (await response.json()) as { ok: boolean; result: TelegramUpdate[] };
    return payload.ok ? payload.result : [];
  }

  private async handleUpdate(update: TelegramUpdate) {
    const text = update.message?.text?.trim();
    const voiceFileId = update.message?.voice?.file_id;
    const chatId = update.message?.chat?.id;
    const userId = update.message?.from?.id;

    if ((!text && !voiceFileId) || chatId === undefined || userId === undefined) {
      return;
    }

    const allowed = isTelegramUserAllowed(String(userId), this.params.allowedUsers);
    if (!allowed) {
      await this.sendMessage(chatId, "Access denied: your Telegram user ID is not whitelisted.");
      return;
    }

    let inboundMessage = text ?? "";
    if (!inboundMessage && voiceFileId && this.params.botToken) {
      const transcription = await this.params.stt.transcribeTelegramVoice(this.params.botToken, voiceFileId);
      if (!transcription) {
        await this.sendMessage(chatId, "Voice transcription unavailable. Configure OPENAI_API_KEY for STT support.");
        return;
      }
      inboundMessage = transcription;
      await this.sendMessage(chatId, `Transcribed voice message: ${transcription}`);
    }

    const voiceMode = inboundMessage.startsWith("/voice ");
    const runMessage = voiceMode ? inboundMessage.replace(/^\/voice\s+/, "") : inboundMessage;
    const result = await this.params.orchestrator.run({
      agentId: "main",
      message: runMessage,
      mode: "direct",
      source: "telegram",
      chatId: String(chatId)
    });

    if (voiceMode) {
      const audio = await this.params.elevenLabs.synthesize(result.finalText);
      if (audio) {
        await this.sendVoice(chatId, audio);
        await this.sendMessage(chatId, "Voice response delivered (ElevenLabs). Text copy:\n" + result.finalText);
        return;
      }
    }

    await this.sendMessage(chatId, result.finalText);
  }

  private async sendMessage(chatId: number, text: string) {
    await fetch(`https://api.telegram.org/bot${this.params.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  }

  private async sendVoice(chatId: number, audio: Buffer) {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append("voice", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "reply.mp3");

    await fetch(`https://api.telegram.org/bot${this.params.botToken}/sendVoice`, {
      method: "POST",
      body: formData
    });
  }
}
