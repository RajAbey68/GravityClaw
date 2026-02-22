import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "@/src/core/types";

interface MediaGenerateInput {
  prompt: string;
  style?: string;
  includeImage?: boolean;
  includeAudio?: boolean;
  includeVideo?: boolean;
}

interface MediaGenerateOutput {
  runId: string;
  folder: string;
  scriptPath: string;
  imagePath?: string;
  audioPath?: string;
  videoStoryboardPath?: string;
  warnings: string[];
}

function createScript(input: MediaGenerateInput) {
  const style = input.style?.trim() || "concise social promo";
  return [
    `Title: ${input.prompt.slice(0, 80)}`,
    ``,
    `Style: ${style}`,
    `Objective: ${input.prompt}`,
    ``,
    `Narration Script:`,
    `Hook: ${input.prompt}`,
    `Body: Explain the key value in 3 points and include one clear call to action.`,
    `CTA: Learn more and follow for updates.`
  ].join("\n");
}

async function maybeGenerateImage(prompt: string, outputDir: string, warnings: string[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    warnings.push("OPENAI_API_KEY missing; image generation skipped.");
    return undefined;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024"
      })
    });
    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
      error?: { message?: string };
    };
    if (!response.ok || !payload.data?.[0]?.b64_json) {
      warnings.push(payload.error?.message ?? "Image generation request failed.");
      return undefined;
    }

    const imagePath = path.join(outputDir, "image.png");
    fs.writeFileSync(imagePath, Buffer.from(payload.data[0].b64_json, "base64"));
    return imagePath;
  } catch (error) {
    warnings.push(`Image generation error: ${(error as Error).message}`);
    return undefined;
  }
}

async function maybeGenerateAudio(script: string, outputDir: string, warnings: string[]) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  if (!key) {
    warnings.push("ELEVENLABS_API_KEY missing; audio generation skipped.");
    return undefined;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": key
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2"
      })
    });
    if (!response.ok) {
      warnings.push(`Audio generation failed with status ${response.status}.`);
      return undefined;
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioPath = path.join(outputDir, "voice.mp3");
    fs.writeFileSync(audioPath, Buffer.from(arrayBuffer));
    return audioPath;
  } catch (error) {
    warnings.push(`Audio generation error: ${(error as Error).message}`);
    return undefined;
  }
}

function maybeGenerateVideoStoryboard(prompt: string, outputDir: string) {
  const storyboard = [
    `# Video Storyboard`,
    ``,
    `Prompt: ${prompt}`,
    ``,
    `1. Scene 1 (0-4s): Bold intro with product context.`,
    `2. Scene 2 (4-9s): Show three key benefits as overlays.`,
    `3. Scene 3 (9-14s): Quick testimonial or proof point.`,
    `4. Scene 4 (14-20s): CTA with branding and URL.`,
    ``,
    `Suggested format: 1080x1920 vertical, 24fps, 20 seconds.`
  ].join("\n");
  const filePath = path.join(outputDir, "video-storyboard.md");
  fs.writeFileSync(filePath, storyboard, "utf8");
  return filePath;
}

export const mediaGenerateTool: ToolDefinition<MediaGenerateInput, MediaGenerateOutput> = {
  id: "media-generate",
  description: "Generate multimedia campaign assets (script, optional image/audio/storyboard) from a prompt.",
  risk: "elevated",
  async execute(input) {
    const prompt = input.prompt?.trim();
    if (!prompt) {
      throw new Error("prompt is required");
    }

    const runId = randomUUID();
    const outputDir = path.resolve(process.cwd(), "data", "media", runId);
    fs.mkdirSync(outputDir, { recursive: true });

    const warnings: string[] = [];
    const script = createScript(input);
    const scriptPath = path.join(outputDir, "script.txt");
    fs.writeFileSync(scriptPath, script, "utf8");

    const includeImage = input.includeImage ?? true;
    const includeAudio = input.includeAudio ?? true;
    const includeVideo = input.includeVideo ?? true;

    const imagePath = includeImage ? await maybeGenerateImage(prompt, outputDir, warnings) : undefined;
    const audioPath = includeAudio ? await maybeGenerateAudio(script, outputDir, warnings) : undefined;
    const videoStoryboardPath = includeVideo ? maybeGenerateVideoStoryboard(prompt, outputDir) : undefined;

    return {
      runId,
      folder: path.relative(process.cwd(), outputDir).replace(/\\/g, "/"),
      scriptPath: path.relative(process.cwd(), scriptPath).replace(/\\/g, "/"),
      imagePath: imagePath ? path.relative(process.cwd(), imagePath).replace(/\\/g, "/") : undefined,
      audioPath: audioPath ? path.relative(process.cwd(), audioPath).replace(/\\/g, "/") : undefined,
      videoStoryboardPath: videoStoryboardPath
        ? path.relative(process.cwd(), videoStoryboardPath).replace(/\\/g, "/")
        : undefined,
      warnings
    };
  }
};

