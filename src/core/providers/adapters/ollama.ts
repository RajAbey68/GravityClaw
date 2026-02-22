import type { GenerationInput, GenerationOutput, ModelInfo, ModelProvider, EmbeddingOutput } from "@/src/core/providers/types";

const FALLBACK_MODELS = [
  "llama3.2",
  "mistral",
  "codellama",
  "gemma2",
  "phi3",
  "deepseek-r1",
  "qwen2.5"
];

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

export class OllamaProvider implements ModelProvider {
  name = "ollama" as const;
  private modelCache: string[] = [...FALLBACK_MODELS];

  constructor(
    private readonly baseUrl: string,
    private readonly enabled: boolean
  ) {}

  get available() {
    return this.enabled;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.enabled) {
      return this.modelCache.map((model) => ({ id: model, label: model }));
    }

    const { signal, clear } = timeoutSignal(15_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal });
      if (!response.ok) {
        return this.modelCache.map((model) => ({ id: model, label: model }));
      }
      const payload = (await response.json()) as {
        models?: Array<{ name?: string }>;
      };
      const models = (payload.models ?? [])
        .map((model) => model.name?.trim() ?? "")
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
    if (!this.enabled) {
      return {
        text: "Ollama provider is disabled. Set OLLAMA_ENABLED=true.",
        inputTokens: 0,
        outputTokens: 0,
        failed: true,
        error: "provider-disabled"
      };
    }

    const { signal, clear } = timeoutSignal(input.timeoutMs ?? 30_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: input.model,
          stream: false,
          options: {
            num_predict: input.maxTokens ?? 800
          },
          messages: [
            { role: "system", content: input.systemPrompt },
            ...input.messages.map((message) => ({ role: message.role, content: message.content }))
          ]
        }),
        signal
      });

      const payload = (await response.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
        error?: string;
      };
      if (!response.ok) {
        return {
          text: payload.error ?? "Ollama request failed.",
          inputTokens: 0,
          outputTokens: 0,
          failed: true,
          error: "request-failed",
          statusCode: response.status
        };
      }

      return {
        text: payload.message?.content ?? "",
        inputTokens: payload.prompt_eval_count ?? 0,
        outputTokens: payload.eval_count ?? 0
      };
    } catch (error) {
      const message = String((error as Error)?.message ?? "Ollama request failed");
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
    if (!this.enabled) {
      return {
        embedding: [],
        usage: { tokens: 0 },
        failed: true,
        error: "Ollama provider is disabled."
      };
    }

    const { signal, clear } = timeoutSignal(30_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: model ?? "llama3.2",
          input: text
        }),
        signal
      });

      const payload = (await response.json()) as {
        embeddings?: number[][];
        prompt_eval_count?: number;
        error?: string;
      };

      if (!response.ok) {
        return {
          embedding: [],
          usage: { tokens: 0 },
          failed: true,
          error: payload.error ?? "Ollama embedding request failed."
        };
      }

      return {
        embedding: payload.embeddings?.[0] ?? [],
        usage: { tokens: payload.prompt_eval_count ?? 0 }
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
