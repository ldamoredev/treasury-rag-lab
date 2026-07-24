import type {
  Document,
  SearchResult,
} from "@treasury-rag/contracts";

import { cosineSimilarity } from "./cosineSimilarity.js";
import type { EmbeddedChunk } from "./EmbeddedChunk.js";

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
        // The citation text stays the document's own words. The prefix that
        // helped this chunk rank travels beside it, never inside it.
        text: chunk.text,
        contextualPrefix: chunk.contextualPrefix,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      };
    });
}
