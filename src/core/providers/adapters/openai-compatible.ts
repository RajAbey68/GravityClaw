import type {
  GenerationInput,
  GenerationOutput,
  ModelInfo,
  ModelProvider,
  ProviderId,
  EmbeddingOutput
} from "@/src/core/providers/types";

interface OpenAICompatibleProviderConfig {
  name: ProviderId;
  endpoint: string;
  models: string[];
  apiKey?: string;
  keyHeader?: string;
  timeoutMs?: number;
  additionalHeaders?: Record<string, string>;
  requireApiKey?: boolean;
  systemPromptMode?: "message" | "top-level";
}

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

function normalizeError(error: unknown) {
  const message = String((error as Error)?.message ?? "request failed");
  if (message.toLowerCase().includes("abort")) {
    return "request timed out";
  }
  return message;
}

function formatModelInfo(models: string[]): ModelInfo[] {
  return models.map((model) => ({ id: model, label: model }));
}

function reasoningEffort(input: GenerationInput) {
  if (input.thinkingLevel === "high") return "high";
  if (input.thinkingLevel === "medium") return "medium";
  if (input.thinkingLevel === "low") return "low";
  return undefined;
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: ProviderId;
  private readonly endpoint: string;
  private readonly models: string[];
  private readonly apiKey?: string;
  private readonly keyHeader: string;
  private readonly timeoutMs: number;
  private readonly additionalHeaders: Record<string, string>;
  private readonly requireApiKey: boolean;
  private readonly systemPromptMode: "message" | "top-level";

  constructor(config: OpenAICompatibleProviderConfig) {
    this.name = config.name;
    this.endpoint = config.endpoint;
    this.models = config.models;
    this.apiKey = config.apiKey;
    this.keyHeader = config.keyHeader ?? "authorization";
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.additionalHeaders = config.additionalHeaders ?? {};
    this.requireApiKey = config.requireApiKey ?? true;
    this.systemPromptMode = config.systemPromptMode ?? "message";
  }

  get available() {
    if (!this.requireApiKey) {
      return true;
    }
    return Boolean(this.apiKey?.trim());
  }

  async listModels(): Promise<ModelInfo[]> {
    return formatModelInfo(this.models);
  }

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    if (!this.available) {
      return {
        text: `${this.name} key is missing.`,
        inputTokens: 0,
        outputTokens: 0,
        failed: true,
        error: "missing-api-key"
      };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.additionalHeaders
    };

    if (this.apiKey?.trim()) {
      if (this.keyHeader.toLowerCase() === "authorization") {
        headers.authorization = `Bearer ${this.apiKey}`;
      } else {
        headers[this.keyHeader] = this.apiKey;
      }
    }

    const messages =
      this.systemPromptMode === "message"
        ? [
            { role: "system", content: input.systemPrompt },
            ...input.messages.map((message) => ({ role: message.role, content: message.content }))
          ]
        : input.messages.map((message) => ({ role: message.role, content: message.content }));

    const effort = reasoningEffort(input);
    const reasoningModel = input.model.startsWith("o3") || input.model.startsWith("o4");
    const payload: Record<string, unknown> = {
      model: input.model,
      messages,
      max_tokens: input.maxTokens ?? 800
    };
    if (reasoningModel && effort) {
      payload.reasoning_effort = effort;
    } else if (input.thinkingLevel && input.thinkingLevel !== "off") {
      payload.temperature = input.thinkingLevel === "high" ? 0.2 : 0.4;
    }

    const { signal, clear } = timeoutSignal(input.timeoutMs ?? this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal
      });
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      };
      if (!response.ok) {
        return {
          text: body.error?.message ?? `${this.name} request failed`,
          inputTokens: 0,
          outputTokens: 0,
          failed: true,
          error: "request-failed",
          statusCode: response.status
        };
      }
      return {
        text: body.choices?.[0]?.message?.content ?? "",
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0
      };
    } catch (error) {
      return {
        text: normalizeError(error),
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
        error: "missing-api-key"
      };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.additionalHeaders
    };

    if (this.apiKey?.trim()) {
      if (this.keyHeader.toLowerCase() === "authorization") {
        headers.authorization = `Bearer ${this.apiKey}`;
      } else {
        headers[this.keyHeader] = this.apiKey;
      }
    }

    const embeddingEndpoint = this.endpoint.replace("/chat/completions", "/embeddings");
    const { signal, clear } = timeoutSignal(this.timeoutMs);
    
    try {
      const response = await fetch(embeddingEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: text,
          model: model ?? "text-embedding-3-small"
        }),
        signal
      });

      const body = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
        usage?: { total_tokens?: number };
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          embedding: [],
          usage: { tokens: 0 },
          failed: true,
          error: body.error?.message ?? "embedding request failed"
        };
      }

      return {
        embedding: body.data?.[0]?.embedding ?? [],
        usage: { tokens: body.usage?.total_tokens ?? 0 }
      };
    } catch (error) {
      return {
        embedding: [],
        usage: { tokens: 0 },
        failed: true,
        error: normalizeError(error)
      };
    } finally {
      clear();
    }
  }
}
