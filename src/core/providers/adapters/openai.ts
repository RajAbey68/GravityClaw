import { OpenAICompatibleProvider } from "@/src/core/providers/adapters/openai-compatible";

const MODELS = [
  "GPT-5.2",
  "GPT-5.2-Instant",
  "GPT-5.2-Thinking",
  "GPT-5.2-Pro",
  "GPT-5.2-Codex"
];

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey?: string) {
    super({
      name: "openai",
      endpoint: "https://api.openai.com/v1/chat/completions",
      models: MODELS,
      apiKey
    });
  }
}
