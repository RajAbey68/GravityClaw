import { MemoryRepository } from "./repositories/memories";
import type { Attachment } from "../types";

export interface MultimodalProcessResult {
  indexedCount: number;
}

export class MultimodalMemoryProcessor {
  constructor(private readonly repository: MemoryRepository) {}

  /**
   * Processes a list of attachments and indexes them as multimodal memories.
   */
  async processAttachments(
    namespace: string,
    attachments: Attachment[]
  ): Promise<MultimodalProcessResult> {
    if (!attachments || attachments.length === 0) {
      return { indexedCount: 0 };
    }

    let indexedCount = 0;
    for (const attachment of attachments) {
      try {
        const isImage = attachment.type.startsWith("image/");
        const isAudio = attachment.type.startsWith("audio/");
        const kind = isImage ? "multimodal:image" : isAudio ? "multimodal:audio" : "multimodal:file";

        // Create a searchable memory record for the attachment
        const content = `[Multimodal Attachment] Name: ${attachment.name}, Type: ${attachment.type}${
          attachment.uri ? `, URI: ${attachment.uri}` : ""
        }`;

        await this.repository.add(namespace, kind, content);
        
        // Update annotation with original attachment metadata
        // We'll use the last inserted ID (a bit hacky, but standard for this repo's SQLite pattern)
        const stats = await this.repository.list(namespace, 1);
        if (stats.length > 0) {
          const latest = stats[0];
          await this.repository.updateAnnotation(latest.id, {
            summary: `Multimodal resource: ${attachment.name}`
          });
        }

        indexedCount++;
      } catch (error) {
        console.error(`Failed to process attachment ${attachment.name}:`, error);
      }
    }

    return { indexedCount };
  }
}
