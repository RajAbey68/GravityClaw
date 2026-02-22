export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
  "deepseek",
  "groq",
  "openrouter",
  "ollama"
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface ModelInfo {
  id: string;
  label: string;
}

export interface GenerationInput {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model: string;
  maxTokens?: number;
  thinkingLevel?: ThinkingLevel;
  workspaceId?: string;
  timeoutMs?: number;
}

export interface GenerationOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
  failed?: boolean;
  error?: string;
  statusCode?: number;
}

export interface EmbeddingOutput {
  embedding: number[];
  usage: { tokens: number };
  failed?: boolean;
  error?: string;
}

export interface StreamChunk {
  type: "content" | "done";
  content?: string;
}

export interface ModelProvider {
  name: ProviderId;
  available: boolean;
  listModels(): Promise<ModelInfo[]>;
  generate(input: GenerationInput): Promise<GenerationOutput>;
  embed(text: string, model?: string): Promise<EmbeddingOutput>;
  stream?(input: GenerationInput): AsyncIterable<StreamChunk>;
}
