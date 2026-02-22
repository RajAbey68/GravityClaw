import type { GenerationInput, GenerationOutput, ModelInfo, ModelProvider, EmbeddingOutput } from "@/src/core/providers/types";

const MODELS = [
  "Gemini-3.1-Pro",
  "Gemini-3-Pro",
  "Gemini-3-Pro-DeepThink",
  "Gemini-3-Flash"
];

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

export class GeminiProvider implements ModelProvider {
  name = "gemini" as const;

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
        text: "Gemini key is missing. Add GEMINI_API_KEY to enable this provider.",
        inputTokens: 0,
        outputTokens: 0,
        failed: true,
        error: "missing-api-key"
      };
    }

    const thoughtInstruction =
      input.thinkingLevel && input.thinkingLevel !== "off"
        ? `\n\nReasoning depth: ${input.thinkingLevel}. Focus on concise structured thinking.`
        : "";

    const { signal, clear } = timeoutSignal(input.timeoutMs ?? 30_000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: `${input.systemPrompt}${thoughtInstruction}` }] },
            generationConfig: {
              maxOutputTokens: input.maxTokens ?? 800
            },
            contents: input.messages.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }]
            }))
          }),
          signal
        }
      );

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          text: payload.error?.message ?? "Gemini request failed.",
          inputTokens: 0,
          outputTokens: 0,
          failed: true,
          error: "request-failed",
          statusCode: response.status
        };
      }

      return {
        text: payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
        inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0
      };
    } catch (error) {
      const message = String((error as Error)?.message ?? "Gemini request failed");
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
    if (!this.apiKey) {
      return {
        embedding: [],
        usage: { tokens: 0 },
        failed: true,
        error: "missing-api-key"
      };
    }

    const { signal, clear } = timeoutSignal(30_000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model ?? "text-embedding-004"}:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text }] }
          }),
          signal
        }
      );

      const payload = (await response.json()) as {
        embedding?: { values: number[] };
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          embedding: [],
          usage: { tokens: 0 },
          failed: true,
          error: payload.error?.message ?? "Gemini embedding request failed."
        };
      }

      return {
        embedding: payload.embedding?.values ?? [],
        usage: { tokens: 0 } // Gemini doesn't always return token count for embeddings in this API
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
