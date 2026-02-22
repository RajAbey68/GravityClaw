import { OpenAICompatibleProvider } from "@/src/core/providers/adapters/openai-compatible";

const MODELS = ["deepseek-chat", "deepseek-reasoner"];

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(apiKey?: string) {
    super({
      name: "deepseek",
      endpoint: "https://api.deepseek.com/v1/chat/completions",
      models: MODELS,
      apiKey
    });
  }
}
