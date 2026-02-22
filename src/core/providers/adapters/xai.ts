import { OpenAICompatibleProvider } from "@/src/core/providers/adapters/openai-compatible";

const MODELS = [
  "Grok-4",
  "Grok-4.1",
  "Grok-4-Fast",
  "Grok-Code-Fast-1"
];

export class XAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey?: string) {
    super({
      name: "xai",
      endpoint: "https://api.x.ai/v1/chat/completions",
      models: MODELS,
      apiKey
    });
  }
}
