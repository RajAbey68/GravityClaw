import type { AgentMode, AgentRunRequest } from "@/src/core/types";
import type { AppContainer } from "@/src/core/container";
import type { ProviderId } from "@/src/core/providers/types";

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface ParsedSlashCommand {
  command:
    | "new"
    | "list"
    | "status"
    | "model"
    | "think"
    | "usage"
    | "compact"
    | "search"
    | "delegate"
    | "spawn"
    | "memory"
    | "forge"
    | "mesh"
    | "talkmode"
    | "clear";
  args: string;
}

export interface SlashContext {
  container: AppContainer;
  workspaceId: string;
  agentId: string;
  mode: AgentMode;
  conversationId?: string;
}

export interface SlashExecutionResult {
  handled: boolean;
  responseText?: string;
  conversationId?: string;
  clearView?: boolean;
  orchestratorRequest?: AgentRunRequest;
}

const COMMANDS = new Set([
  "new",
  "list",
  "status",
  "model",
  "think",
  "usage",
  "compact",
  "search",
  "delegate",
  "spawn",
  "memory",
  "forge",
  "mesh",
  "talkmode",
  "clear"
]);

function toThinkingLevel(value: string): ThinkingLevel | undefined {
  if (value === "off" || value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return undefined;
}

export function parseSlashCommand(message: string) {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }
  const withoutPrefix = trimmed.slice(1);
  const space = withoutPrefix.indexOf(" ");
  const rawCommand = (space === -1 ? withoutPrefix : withoutPrefix.slice(0, space)).toLowerCase();
  if (!COMMANDS.has(rawCommand)) {
    return undefined;
  }
  const args = space === -1 ? "" : withoutPrefix.slice(space + 1).trim();
  return {
    command: rawCommand as ParsedSlashCommand["command"],
    args
  };
}

function formatUsage(usage: {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  requests: number;
}) {
  return [
    "Usage summary",
    `- requests: ${usage.requests}`,
    `- input tokens: ${usage.inputTokens}`,
    `- output tokens: ${usage.outputTokens}`,
    `- estimated cost usd: ${usage.estimatedCostUsd.toFixed(6)}`
  ].join("\n");
}

export async function executeSlashCommand(
  parsed: ParsedSlashCommand,
  context: SlashContext
): Promise<SlashExecutionResult> {
  const { container, workspaceId, agentId } = context;
  switch (parsed.command) {
    case "new": {
      const title = parsed.args || `Conversation ${new Date().toLocaleString()}`;
      const created = await container.conversations.create({
        workspaceId,
        agentId,
        mode: context.mode,
        title
      });
      return {
        handled: true,
        responseText: `Created new conversation '${created?.id ?? "unknown"}'.`,
        conversationId: created?.id
      };
    }
    case "list": {
      const conversations = await container.conversations.list({
        workspaceId,
        limit: 12
      });
      if (conversations.length === 0) {
        return {
          handled: true,
          responseText: "No conversations yet."
        };
      }
      return {
        handled: true,
        responseText: [
          "Recent conversations:",
          ...conversations.map(
            (conversation) =>
              `- ${conversation.id} (${conversation.mode}) ${conversation.title ?? "(untitled)"}`
          )
        ].join("\n")
      };
    }
    case "status": {
      const agent = container.lifecycle.get(agentId, workspaceId);
      if (!agent) {
        return { handled: true, responseText: `Agent '${agentId}' not found.` };
      }
      const latestStep = await container.events.latestStepForAgent(workspaceId, agentId);
      const provider = container.providers.getCurrent();
      return {
        handled: true,
        responseText: [
          `Agent status for ${agentId}`,
          `- workspace: ${workspaceId}`,
          `- status: ${agent.status}`,
          `- mode: ${context.mode}`,
          `- provider/model: ${agent.provider ?? provider.provider}/${agent.model ?? provider.model}`,
          `- iteration: ${latestStep?.iteration ?? 0}`,
          `- step: ${latestStep?.phase ?? "idle"}`
        ].join("\n")
      };
    }
    case "model": {
      const target = parsed.args.trim();
      const [providerRaw, ...modelParts] = target.split("/");
      const provider = providerRaw?.trim() as ProviderId | undefined;
      const model = modelParts.join("/").trim();
      if (!provider || !model) {
        return {
          handled: true,
          responseText: "Usage: /model provider/model"
        };
      }
      const available = await container.providers.list();
      const providerEntry = available.find((entry) => entry.name === provider);
      if (!providerEntry || !providerEntry.models.includes(model)) {
        return {
          handled: true,
          responseText: `Model '${provider}/${model}' is not available in current registry.`
        };
      }
      await container.lifecycle.updateAgent(agentId, workspaceId, {
        provider,
        model
      });
      await container.providers.setCurrent(provider, model);
      return {
        handled: true,
        responseText: `Model switched to ${provider}/${model}.`
      };
    }
    case "think": {
      const level = toThinkingLevel(parsed.args.trim().toLowerCase());
      if (!level) {
        return {
          handled: true,
          responseText: "Usage: /think off|low|medium|high"
        };
      }
      await container.memories.setSetting(`agent.thinkingLevel:${workspaceId}:${agentId}`, level);
      return {
        handled: true,
        responseText: `Thinking level set to '${level}' for ${agentId}.`
      };
    }
    case "usage": {
      const usage = await container.events.providerUsageTotals();
      return {
        handled: true,
        responseText: formatUsage(usage)
      };
    }
    case "compact": {
      const compressed = await container.memories.compressNamespace(`workspace:${workspaceId}:agent:${agentId}`);
      return {
        handled: true,
        responseText: compressed ? "Conversation context compressed." : "Not enough context to compact yet."
      };
    }
    case "search": {
      const query = parsed.args.trim();
      if (!query) {
        return { handled: true, responseText: "Usage: /search <query>" };
      }
      const messages = await container.conversations.searchMessages({
        workspaceId,
        query,
        limit: 12
      });
      if (messages.length === 0) {
        return { handled: true, responseText: "No conversation matches found." };
      }
      return {
        handled: true,
        responseText: [
          `Search results for "${query}":`,
          ...messages.map((message) => `- [${message.conversation_id}] ${message.content.slice(0, 120)}`)
        ].join("\n")
      };
    }
    case "delegate": {
      const args = parsed.args.trim();
      const firstSpace = args.indexOf(" ");
      if (firstSpace === -1) {
        return { handled: true, responseText: "Usage: /delegate <agentId> <task>" };
      }
      const targetAgentId = args.slice(0, firstSpace).trim();
      const task = args.slice(firstSpace + 1).trim();
      if (!targetAgentId || !task) {
        return { handled: true, responseText: "Usage: /delegate <agentId> <task>" };
      }
      return {
        handled: true,
        orchestratorRequest: {
          agentId,
          workspaceId,
          mode: "delegated",
          message: `/delegate ${targetAgentId} ${task}`
        }
      };
    }
    case "spawn": {
      const label = parsed.args.trim();
      if (!label) {
        return { handled: true, responseText: "Usage: /spawn <name>" };
      }
      return {
        handled: true,
        orchestratorRequest: {
          agentId,
          workspaceId,
          mode: "direct",
          message: `/spawn ${label}`
        }
      };
    }
    case "memory": {
      const query = parsed.args.trim();
      if (!query) {
        return { handled: true, responseText: "Usage: /memory <query>" };
      }
      return {
        handled: true,
        orchestratorRequest: {
          agentId,
          workspaceId,
          mode: "direct",
          message: `/memory search ${query}`
        }
      };
    }
    case "forge": {
      if (!parsed.args.trim()) {
        return { handled: true, responseText: "Usage: /forge <capability>" };
      }
      return {
        handled: true,
        orchestratorRequest: {
          agentId,
          workspaceId,
          mode: "direct",
          message: `/forge ${parsed.args.trim()}`
        }
      };
    }
    case "clear": {
      return {
        handled: true,
        clearView: true,
        responseText: "Cleared local chat view."
      };
    }
    case "talkmode": {
      return {
        handled: true,
        responseText: "Toggling immersive talk mode...",
        // In a real implementation, we'd emit a system event that the UI listens to
        // or the UI would handle the response text 'talkmode' as a signal.
      };
    }
    case "mesh": {
      const goal = parsed.args.trim();
      if (!goal) {
        return { handled: true, responseText: "Usage: /mesh <goal>" };
      }
      // Trigger mesh orchestration
      // Since this is a long-running process, we'll run it in the background
      // and let events notify the UI.
      void context.container.mesh.runMesh(goal, workspaceId);
      return {
        handled: true,
        responseText: `Agent Mesh initialized for goal: "${goal}". Monitor development in Canvas/LiveFeed.`
      };
    }
    default:
      return { handled: false };
  }
}
