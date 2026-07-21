import {
  ChunkPreviewResponseSchema,
  type Chunk,
  type ChunkPreviewResponse,
  type ChunkingConfig,
  type Document,
} from "@treasury-rag/contracts";

import { chunkDocument } from "./chunk-document.js";

function calculateStats(document: Document, chunks: Chunk[]) {
  const lengths = chunks.map((chunk) => chunk.text.length);
  const totalChunkCharacters = lengths.reduce((total, length) => total + length, 0);

  return {
    documentCharacters: document.content.length,
    chunkCount: chunks.length,
    duplicatedCharacters: Math.max(
      0,
      totalChunkCharacters - document.content.length,
    ),
    minimumChunkCharacters: lengths.length === 0 ? 0 : Math.min(...lengths),
    maximumChunkCharacters: lengths.length === 0 ? 0 : Math.max(...lengths),
    averageChunkCharacters:
      lengths.length === 0 ? 0 : totalChunkCharacters / lengths.length,
  };
}

export function createChunkPreview(
  document: Document,
  config: ChunkingConfig,
): ChunkPreviewResponse {
  const chunks = chunkDocument(document, config);

  return ChunkPreviewResponseSchema.parse({
    document: {
      id: document.id,
      title: document.title,
      tenant: document.tenant,
      version: document.version,
      effectiveFrom: document.effectiveFrom,
    },
    config,
    chunks,
    stats: calculateStats(document, chunks),
  });
}
