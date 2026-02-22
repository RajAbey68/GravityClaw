import { OpenAICompatibleProvider } from "@/src/core/providers/adapters/openai-compatible";

const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "qwen-qwq-32b"
];

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(apiKey?: string) {
    super({
      name: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      models: MODELS,
      apiKey
    });
  }
}
