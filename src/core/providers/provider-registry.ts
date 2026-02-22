import { AnthropicProvider } from "@/src/core/providers/adapters/anthropic";
import { DeepSeekProvider } from "@/src/core/providers/adapters/deepseek";
import { GeminiProvider } from "@/src/core/providers/adapters/gemini";
import { GroqProvider } from "@/src/core/providers/adapters/groq";
import { OllamaProvider } from "@/src/core/providers/adapters/ollama";
import { OpenAIProvider } from "@/src/core/providers/adapters/openai";
import { OpenRouterProvider } from "@/src/core/providers/adapters/openrouter";
import { XAIProvider } from "@/src/core/providers/adapters/xai";
import type {
  GenerationInput,
  GenerationOutput,
  ModelProvider,
  ProviderId
} from "@/src/core/providers/types";
import { PROVIDER_IDS } from "@/src/core/providers/types";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";
import { WorkspaceRepository } from "@/src/core/memory/repositories/workspaces";
import type { SystemEventBus } from "@/src/core/interface/websocket/event-bus";

type ProviderHealthState = "idle" | "ready" | "missing-key" | "error";

interface ProviderHealth {
  state: ProviderHealthState;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  failureRate1h?: number;
}

interface FailoverTarget {
  provider: ProviderId;
  model: string;
}

interface RegistrySettings {
  currentProvider: ProviderId;
  currentModel: string;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  xaiKey?: string;
  deepseekKey?: string;
  groqKey?: string;
  openrouterKey?: string;
  ollamaBaseUrl: string;
  ollamaEnabled: boolean;
}

interface ProviderStats {
  attempts: number;
  failures: number;
  events: Array<{ ts: number; ok: boolean }>;
}

const FALLBACK_KEY = "provider.failover";
const FAILOVER_LIST_KEY = "provider.failoverList";

const MODEL_COST_PER_1K: Record<string, { in: number; out: number }> = {
  "GPT-5.2": { in: 0.015, out: 0.045 },
  "GPT-5.2-Instant": { in: 0.001, out: 0.003 },
  "GPT-5.2-Thinking": { in: 0.02, out: 0.06 },
  "claude-opus-4-6": { in: 0.015, out: 0.075 },
  "claude-sonnet-4-6": { in: 0.003, out: 0.015 },
  "Gemini-3.1-Pro": { in: 0.00125, out: 0.005 },
  "Grok-4": { in: 0.005, out: 0.015 },
  "deepseek-chat": { in: 0.00014, out: 0.00028 },
  "deepseek-reasoner": { in: 0.00055, out: 0.0022 }
};

function now() {
  return new Date().toISOString();
}

function normalizeProviderId(value: string | undefined): ProviderId | undefined {
  if (!value) return undefined;
  return PROVIDER_IDS.find((id) => id === value);
}

function normalizeFailoverList(input: unknown): FailoverTarget[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const list: FailoverTarget[] = [];
  for (const item of input) {
    const raw = item as { provider?: string; model?: string };
    const provider = normalizeProviderId(raw.provider);
    const model = String(raw.model ?? "").trim();
    if (!provider || !model) continue;
    list.push({ provider, model });
  }
  return list;
}

function uniqueCandidates(items: FailoverTarget[]) {
  const seen = new Set<string>();
  const deduped: FailoverTarget[] = [];
  for (const item of items) {
    const key = `${item.provider}:${item.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function makeStats(): ProviderStats {
  return {
    attempts: 0,
    failures: 0,
    events: []
  };
}

export class ProviderRegistry {
  private providers: Record<ProviderId, ModelProvider>;
  private readonly apiKeys: Record<Exclude<ProviderId, "ollama">, string | undefined>;
  private readonly ollamaBaseUrl: string;
  private readonly ollamaEnabled: boolean;
  private currentProvider: ProviderId;
  private currentModel: string;
  private failoverEnabled = true;
  private failoverList: FailoverTarget[] = [];
  private readonly health: Record<ProviderId, ProviderHealth>;
  private readonly stats: Record<ProviderId, ProviderStats>;

  constructor(
    private readonly settingsRepo: MemoryRepository,
    private readonly workspaces: WorkspaceRepository,
    params: RegistrySettings,
    private readonly eventBus?: SystemEventBus
  ) {
    this.currentProvider = params.currentProvider;
    this.currentModel = params.currentModel;
    this.apiKeys = {
      openai: params.openaiKey,
      anthropic: params.anthropicKey,
      gemini: params.geminiKey,
      xai: params.xaiKey,
      deepseek: params.deepseekKey,
      groq: params.groqKey,
      openrouter: params.openrouterKey
    };
    this.ollamaBaseUrl = params.ollamaBaseUrl;
    this.ollamaEnabled = params.ollamaEnabled;
    this.health = {
      openai: { state: "idle" },
      anthropic: { state: "idle" },
      gemini: { state: "idle" },
      xai: { state: "idle" },
      deepseek: { state: "idle" },
      groq: { state: "idle" },
      openrouter: { state: "idle" },
      ollama: { state: "idle" }
    };
    this.stats = {
      openai: makeStats(),
      anthropic: makeStats(),
      gemini: makeStats(),
      xai: makeStats(),
      deepseek: makeStats(),
      groq: makeStats(),
      openrouter: makeStats(),
      ollama: makeStats()
    };
    this.providers = this.buildProviders();
  }

  get allProviders() {
    return this.providers;
  }

  async init() {
    const provider = normalizeProviderId(await this.settingsRepo.getSetting("provider.current"));
    const model = await this.settingsRepo.getSetting("provider.model");
    const failover = await this.settingsRepo.getSetting(FALLBACK_KEY);
    const failoverListRaw = await this.settingsRepo.getSetting(FAILOVER_LIST_KEY);

    if (provider && this.providers[provider]) {
      this.currentProvider = provider;
    }
    if (model) {
      this.currentModel = model;
    }
    if (failover) {
      this.failoverEnabled = ["1", "true", "yes", "on"].includes(failover.toLowerCase());
    }
    if (failoverListRaw) {
      try {
        const parsed = JSON.parse(failoverListRaw) as unknown;
        this.failoverList = normalizeFailoverList(parsed);
      } catch {
        this.failoverList = [];
      }
    }

    await Promise.all(PROVIDER_IDS.map((name) => this.refreshProviderHealth(name)));
  }

  async list() {
    return Promise.all(
      PROVIDER_IDS.map(async (name) => {
        const provider = this.providers[name];
        const models = await provider.listModels();
        return {
          name: provider.name,
          available: provider.available,
          models: models.map((model) => model.id),
          health: this.health[name]
        };
      })
    );
  }

  getCurrent() {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
      failoverEnabled: this.failoverEnabled,
      failoverList: this.failoverList
    };
  }

  async setCurrent(provider: ProviderId, model?: string) {
    this.currentProvider = provider;
    if (model?.trim()) {
      this.currentModel = model.trim();
    } else {
      const models = await this.providers[provider].listModels();
      if (models.length > 0) {
        this.currentModel = models[0].id;
      }
    }
    await this.settingsRepo.setSetting("provider.current", this.currentProvider);
    await this.settingsRepo.setSetting("provider.model", this.currentModel);
  }

  async setFailover(enabled: boolean) {
    this.failoverEnabled = enabled;
    await this.settingsRepo.setSetting(FALLBACK_KEY, String(enabled));
  }

  async setFailoverList(list: FailoverTarget[]) {
    this.failoverList = uniqueCandidates(normalizeFailoverList(list));
    await this.settingsRepo.setSetting(FAILOVER_LIST_KEY, JSON.stringify(this.failoverList));
  }

  async setApiKeys(input: Partial<Record<Exclude<ProviderId, "ollama">, string | undefined>>) {
    const keys = Object.entries(input) as Array<[Exclude<ProviderId, "ollama">, string | undefined]>;
    for (const [provider, key] of keys) {
      this.apiKeys[provider] = key || undefined;
    }
    this.providers = this.buildProviders();
    await Promise.all(PROVIDER_IDS.map((name) => this.refreshProviderHealth(name)));
  }

  keyState() {
    return {
      openai: this.mask(this.apiKeys.openai),
      anthropic: this.mask(this.apiKeys.anthropic),
      gemini: this.mask(this.apiKeys.gemini),
      xai: this.mask(this.apiKeys.xai),
      deepseek: this.mask(this.apiKeys.deepseek),
      groq: this.mask(this.apiKeys.groq),
      openrouter: this.mask(this.apiKeys.openrouter),
      ollama: {
        configured: this.ollamaEnabled,
        masked: this.ollamaEnabled ? this.ollamaBaseUrl : ""
      }
    };
  }

  async generate(
    input: Omit<GenerationInput, "model"> & {
      workspaceId?: string;
      provider?: ProviderId;
      model?: string;
    }
  ) {
    const workspaceId = input.workspaceId || "default";
    const wsOverrides = await this.getWorkspaceOverrides(workspaceId);

    const activeProvider = input.provider ?? wsOverrides.provider ?? this.currentProvider;
    const activeModel = input.model ?? wsOverrides.model ?? this.currentModel;

    const attempts = await this.resolveProviderOrder(activeProvider, activeModel);

    for (const candidate of attempts) {
      const provider = this.getEffectiveProvider(candidate.provider, wsOverrides.keys);
      const model = await this.resolveModelForProvider(candidate.provider, candidate.model);
      
      this.health[candidate.provider] = {
        ...this.health[candidate.provider],
        lastAttemptAt: now()
      };

      if (!provider.available) {
        this.recordProviderOutcome(candidate.provider, false);
        this.health[candidate.provider] = {
          ...this.health[candidate.provider],
          state: "missing-key",
          lastError: "missing provider key",
          failureRate1h: this.failureRate1h(candidate.provider)
        };
        continue;
      }

      const result = await provider.generate({
        ...input,
        model,
        timeoutMs: input.timeoutMs ?? 30_000
      });

      if (!result.failed) {
        this.recordProviderOutcome(candidate.provider, true);
        this.health[candidate.provider] = {
          ...this.health[candidate.provider],
          state: "ready",
          lastSuccessAt: now(),
          lastError: undefined,
          failureRate1h: this.failureRate1h(candidate.provider)
        };
        return {
          ...result,
          provider: candidate.provider,
          model,
          estimatedCostUsd: this.estimateCost(model, result)
        };
      }

      this.recordProviderOutcome(candidate.provider, false);
      this.health[candidate.provider] = {
        ...this.health[candidate.provider],
        state: "error",
        lastError: result.error ?? result.text,
        failureRate1h: this.failureRate1h(candidate.provider)
      };

      if (!this.failoverEnabled) {
        return {
          ...result,
          provider: candidate.provider,
          model,
          estimatedCostUsd: 0
        };
      }

      // Emit failover event when moving to next candidate
      const nextIdx = attempts.indexOf(candidate) + 1;
      if (this.eventBus && nextIdx < attempts.length) {
        const next = attempts[nextIdx];
        this.eventBus.publish({
          type: "provider.failover",
          timestamp: now(),
          fromProvider: candidate.provider,
          toProvider: next.provider,
          fromModel: model,
          toModel: next.model,
          reason: result.error ?? result.text
        });
      }
    }

    return {
      text: "All configured providers are unavailable or failed.",
      inputTokens: 0,
      outputTokens: 0,
      failed: true,
      error: "all-providers-failed",
      provider: activeProvider,
      model: activeModel,
      estimatedCostUsd: 0
    };
  }

  private async getWorkspaceOverrides(workspaceId: string) {
    const providerStr = await this.workspaces.getConfig(workspaceId, "provider.current");
    const model = await this.workspaces.getConfig(workspaceId, "provider.model");
    const provider = normalizeProviderId(providerStr);

    const keys: Partial<Record<Exclude<ProviderId, "ollama">, string>> = {};
    for (const id of PROVIDER_IDS) {
      if (id === "ollama") continue;
      const key = await this.workspaces.getConfig(workspaceId, `provider.key.${id}`);
      if (key) {
        keys[id] = key;
      }
    }

    return { provider, model, keys };
  }

  private getEffectiveProvider(id: ProviderId, wsKeys: Partial<Record<Exclude<ProviderId, "ollama">, string>>): ModelProvider {
    const wsKey = id === "ollama" ? undefined : wsKeys[id];
    if (!wsKey) {
      return this.providers[id];
    }

    // Return a one-off provider with the workspace-specific key
    switch (id) {
      case "openai": return new OpenAIProvider(wsKey);
      case "anthropic": return new AnthropicProvider(wsKey);
      case "gemini": return new GeminiProvider(wsKey);
      case "xai": return new XAIProvider(wsKey);
      case "deepseek": return new DeepSeekProvider(wsKey);
      case "groq": return new GroqProvider(wsKey);
      case "openrouter": return new OpenRouterProvider(wsKey);
      case "ollama": return this.providers.ollama;
      default: return this.providers[id];
    }
  }

  private async resolveProviderOrder(primaryProvider: ProviderId, primaryModel: string) {
    const baseline: FailoverTarget[] = [{ provider: primaryProvider, model: primaryModel }];
    const configured = this.failoverList.length
      ? this.failoverList
      : await Promise.all(
          PROVIDER_IDS.map(async (provider) => {
            const models = await this.providers[provider].listModels();
            return {
              provider,
              model: models[0]?.id ?? primaryModel
            };
          })
        );
    baseline.push(...configured);
    const deduped = uniqueCandidates(baseline);
    if (!this.failoverEnabled) {
      return deduped.slice(0, 1);
    }

    const priority = [...deduped];
    const stable: FailoverTarget[] = [];
    const risky: FailoverTarget[] = [];
    for (const candidate of priority) {
      if (candidate.provider === primaryProvider) {
        stable.push(candidate);
        continue;
      }
      if (this.shouldDeprioritize(candidate.provider)) {
        risky.push(candidate);
      } else {
        stable.push(candidate);
      }
    }
    return [...stable, ...risky];
  }

  private buildProviders(): Record<ProviderId, ModelProvider> {
    return {
      openai: new OpenAIProvider(this.apiKeys.openai),
      anthropic: new AnthropicProvider(this.apiKeys.anthropic),
      gemini: new GeminiProvider(this.apiKeys.gemini),
      xai: new XAIProvider(this.apiKeys.xai),
      deepseek: new DeepSeekProvider(this.apiKeys.deepseek),
      groq: new GroqProvider(this.apiKeys.groq),
      openrouter: new OpenRouterProvider(this.apiKeys.openrouter),
      ollama: new OllamaProvider(this.ollamaBaseUrl, this.ollamaEnabled)
    };
  }

  private async resolveModelForProvider(providerName: ProviderId, preferredModel: string) {
    if (preferredModel?.trim()) {
      return preferredModel.trim();
    }
    const provider = this.providers[providerName];
    const models = await provider.listModels();
    return models[0]?.id ?? "default";
  }

  private async refreshProviderHealth(providerName: ProviderId) {
    const provider = this.providers[providerName];
    this.health[providerName] = {
      ...this.health[providerName],
      state: provider.available ? "ready" : "missing-key",
      lastAttemptAt: now(),
      lastError: provider.available ? undefined : "missing provider key",
      failureRate1h: this.failureRate1h(providerName)
    };
  }

  private estimateCost(model: string, output: GenerationOutput) {
    const rate = MODEL_COST_PER_1K[model] ?? { in: 0.0002, out: 0.0008 };
    return Number(((output.inputTokens / 1000) * rate.in + (output.outputTokens / 1000) * rate.out).toFixed(6));
  }

  private mask(value: string | undefined) {
    if (!value) {
      return { configured: false, masked: "" };
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return { configured: false, masked: "" };
    }
    const visible = trimmed.slice(-4);
    return {
      configured: true,
      masked: `******${visible}`
    };
  }

  private recordProviderOutcome(provider: ProviderId, ok: boolean) {
    const stat = this.stats[provider];
    stat.attempts += 1;
    if (!ok) {
      stat.failures += 1;
    }
    const nowTs = Date.now();
    stat.events.push({ ts: nowTs, ok });
    const horizon = nowTs - 60 * 60 * 1000;
    stat.events = stat.events.filter((event) => event.ts >= horizon);
  }

  private failureRate1h(provider: ProviderId) {
    const events = this.stats[provider].events;
    if (events.length === 0) return 0;
    const failures = events.filter((event) => !event.ok).length;
    return Number((failures / events.length).toFixed(3));
  }

  private shouldDeprioritize(provider: ProviderId) {
    const events = this.stats[provider].events;
    if (events.length < 4) return false;
    return this.failureRate1h(provider) > 0.5;
  }
}
