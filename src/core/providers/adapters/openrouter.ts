import type { GenerationInput, GenerationOutput, ModelInfo, ModelProvider, EmbeddingOutput } from "@/src/core/providers/types";

const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-4-5",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat"
];

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

export class OpenRouterProvider implements ModelProvider {
  name = "openrouter" as const;
  private modelCache: string[] = [...FALLBACK_MODELS];

  constructor(private readonly apiKey?: string) {}

  get available() {
    return Boolean(this.apiKey?.trim());
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.available) {
      return this.modelCache.map((model) => ({ id: model, label: model }));
    }

    const { signal, clear } = timeoutSignal(20_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Gravity Claw"
        },
        signal
      });
      if (!response.ok) {
        return this.modelCache.map((model) => ({ id: model, label: model }));
      }
      const payload = (await response.json()) as {
        data?: Array<{ id?: string }>;
      };
      const models = (payload.data ?? [])
        .map((entry) => entry.id?.trim() ?? "")
        .filter(Boolean);
      if (models.length > 0) {
        this.modelCache = models;
      }
      return this.modelCache.map((model) => ({ id: model, label: model }));
    } finally {
      clear();
    }
  }

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    if (!this.available) {
      return {
        text: "OpenRouter key is missing.",
        inputTokens: 0,
        outputTokens: 0,
        failed: true,
        error: "missing-api-key"
      };
    }

    const { signal, clear } = timeoutSignal(input.timeoutMs ?? 30_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Gravity Claw"
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            ...input.messages.map((message) => ({ role: message.role, content: message.content }))
          ],
          max_tokens: input.maxTokens ?? 800
        }),
        signal
      });

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          text: payload.error?.message ?? "OpenRouter request failed.",
          inputTokens: 0,
          outputTokens: 0,
          failed: true,
          error: "request-failed",
          statusCode: response.status
        };
      }

      return {
        text: payload.choices?.[0]?.message?.content ?? "",
        inputTokens: payload.usage?.prompt_tokens ?? 0,
        outputTokens: payload.usage?.completion_tokens ?? 0
      };
    } catch (error) {
      const message = String((error as Error)?.message ?? "OpenRouter request failed");
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

  async embed(text: string, model?: string): Promise<EmbeddingOutput> {
    if (!this.available) {
      return {
        embedding: [],
        usage: { tokens: 0 },
        failed: true,
        error: "OpenRouter key is missing."
      };
    }

    const { signal, clear } = timeoutSignal(30_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Gravity Claw"
        },
        body: JSON.stringify({
          model: model ?? "openai/text-embedding-3-small",
          input: text
        }),
        signal
      });

      const payload = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
        usage?: { total_tokens?: number };
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          embedding: [],
          usage: { tokens: 0 },
          failed: true,
          error: payload.error?.message ?? "OpenRouter embedding request failed."
        };
      }

      return {
        embedding: payload.data?.[0]?.embedding ?? [],
        usage: { tokens: payload.usage?.total_tokens ?? 0 }
      };
    } catch (error) {
      return {
        embedding: [],
        usage: { tokens: 0 },
        failed: true,
        error: String(error)
      };
    } finally {
      clear();
    }
  }
}
