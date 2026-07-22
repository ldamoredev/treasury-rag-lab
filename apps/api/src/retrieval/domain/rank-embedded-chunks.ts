import type {
  Document,
  SearchResult,
} from "@treasury-rag/contracts";

import { cosineSimilarity } from "./cosine-similarity.js";
import type { EmbeddedChunk } from "./embedded-chunk.js";

export function rankEmbeddedChunks(
  queryEmbedding: number[],
  embeddedChunks: EmbeddedChunk[],
  documents: Document[],
  threshold: number,
  topK: number,
): SearchResult[] {
  const documentsById = new Map(
    documents.map((document) => [document.id, document]),
  );

  return embeddedChunks
    .map(({ chunk, embedding }) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, embedding),
    }))
    .filter(({ score }) => score >= threshold)
    .sort((left, right) =>
      right.score - left.score || left.chunk.id.localeCompare(right.chunk.id)
    )
    .slice(0, topK)
    .map(({ chunk, score }, index) => {
      const document = documentsById.get(chunk.documentId);
      if (!document) {
        throw new Error(
          `Document ${chunk.documentId} not found for search result`,
        );
      }

      return {
        rank: index + 1,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: document.title,
        tenant: chunk.tenant,
        version: chunk.version,
        effectiveFrom: chunk.effectiveFrom,
        score,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      };
    });
}
