import {
  CharacterChunkingConfigSchema,
  type Chunk,
  type ChunkingConfig,
  type Document,
} from "@treasury-rag/contracts";

import type { ChunkingStrategy } from "./chunking-strategy.js";

export class CharacterWindowChunker implements ChunkingStrategy {
  readonly strategy = "characters" as const;

  chunk(document: Document, candidate: ChunkingConfig): Chunk[] {
    const config = CharacterChunkingConfigSchema.parse(candidate);
    if (document.content.length === 0) {
      return [];
    }

    const chunks: Chunk[] = [];
    const step = config.chunkSize - config.overlap;

    for (
      let startOffset = 0;
      startOffset < document.content.length;
      startOffset += step
    ) {
      const endOffset = Math.min(
        startOffset + config.chunkSize,
        document.content.length,
      );

      chunks.push({
        id: `${document.id}:characters:${config.chunkSize}:${config.overlap}:${chunks.length}`,
        documentId: document.id,
        text: document.content.slice(startOffset, endOffset),
        index: chunks.length,
        tenant: document.tenant,
        version: document.version,
        effectiveFrom: document.effectiveFrom,
        startOffset,
        endOffset,
      });

      if (endOffset === document.content.length) {
        break;
      }
    }

    return chunks;
  }
}
