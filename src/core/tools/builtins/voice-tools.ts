import { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { VoiceManager } from "@/src/core/voice/voice-manager";
import { HiveRepository } from "@/src/core/memory/repositories/hive";

interface SpeakInput {
  text: string;
}

export function createVoiceTools(
  voiceManager: VoiceManager,
  hiveRepo: HiveRepository
): Array<ToolDefinition<any, any>> {
  const speakTool: ToolDefinition<SpeakInput, { ok: boolean }> = {
    id: "speak",
    description: "Proactively speak to the user using your assigned voice. Use this for verbal responses or alerts.",
    risk: "safe",
    async execute(input: SpeakInput, ctx: ToolExecutionContext) {
      if (!input.text) {
        throw new Error("text is required");
      }

      // Fetch agent voice config
      const agent = await hiveRepo.getAgent(ctx.agentId);
      if (!agent) throw new Error("Agent not found");

      if (!agent.voiceId) {
        throw new Error("Agent does not have a voice assigned. Configure voiceId in settings.");
      }

      // VoiceManager.speak handles the emission of the voice.started event
      // The actual audio streaming happens via the API proxy or WebSocket
      // Here we just trigger the intent and the UI responds to the event
      await voiceManager.speak(input.text, {
        voiceId: agent.voiceId,
        stability: agent.voiceStability || 0.5,
        similarityBoost: agent.voiceSimilarityBoost || 0.75
      }, ctx.agentId);

      return { ok: true };
    }
  };

  return [speakTool];
}
