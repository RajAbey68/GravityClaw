import type { GenerationInput, GenerationOutput, ModelInfo, ModelProvider, EmbeddingOutput } from "@/src/core/providers/types";

const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5"
];

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

export class AnthropicProvider implements ModelProvider {
  name = "anthropic" as const;

  constructor(private readonly apiKey?: string) {}

  get available() {
    return Boolean(this.apiKey);
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS.map((model) => ({ id: model, label: model }));
  }

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    if (!this.apiKey) {
      return {
        text: "Anthropic key is missing. Add ANTHROPIC_API_KEY to enable this provider.",
        inputTokens: 0,
        outputTokens: 0,
        failed: true,
        error: "missing-api-key"
      };
    }

    const messages = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }));

    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens ?? 800,
      system: input.systemPrompt,
      messages
    };
    if (input.thinkingLevel && input.thinkingLevel !== "off") {
      const budgetTokens =
        input.thinkingLevel === "high" ? 16000 : input.thinkingLevel === "medium" ? 5000 : 1000;
      body.thinking = { type: "enabled", budget_tokens: budgetTokens };
    }

    const { signal, clear } = timeoutSignal(input.timeoutMs ?? 30_000);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body),
        signal
      });

      const payload = (await response.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          text: payload.error?.message ?? "Anthropic request failed.",
          inputTokens: 0,
          outputTokens: 0,
          failed: true,
          error: "request-failed",
          statusCode: response.status
        };
      }
      return {
        text: payload.content?.[0]?.text ?? "",
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0
      };
    } catch (error) {
      const message = String((error as Error)?.message ?? "Anthropic request failed");
      return {
        text: message.toLowerCase().includes("abort") ? "request timed out" : message,
        inputTokens: 0,
        outputTokens: 0,
        failed: true,
        error: "network-failed"
      };
    } finally {
      clear();
    }
  }

  async embed(_text: string, _model?: string): Promise<EmbeddingOutput> {
    return {
      embedding: [],
      usage: { tokens: 0 },
      failed: true,
      error: "Anthropic does not support native embeddings yet."
    };
  }
}
