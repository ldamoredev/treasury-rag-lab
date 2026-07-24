import type { ContextualizedChunk } from "@treasury-rag/contracts";

import type { EmbeddedChunk } from "../domain/EmbeddedChunk.js";
import type { EmbeddingCache } from "../ports/EmbeddingCache.js";
import type { EmbeddingProvider } from "../ports/EmbeddingProvider.js";

export type EmbedChunksResult = {
  embeddedChunks: EmbeddedChunk[];
  dimensions: number | undefined;
  cacheHits: number;
  cacheMisses: number;
};

/**
 * Embeds the contextual text under the key ingestion produced. That key
 * already carries the contextualizer, its model and its prompt version, so
 * changing contextualization can never serve back a vector that was built
 * from different text. Identical keys still collapse into one provider call.
 */
export async function embedChunks(
  chunks: ContextualizedChunk[],
  provider: EmbeddingProvider,
  cache: EmbeddingCache,
): Promise<EmbedChunksResult> {
  const cached = await cache.getMany([
    ...new Set(chunks.map((chunk) => chunk.embeddingKey)),
  ]);
  const missingTextsByKey = new Map<string, string>();
  let cacheHits = 0;

  for (const chunk of chunks) {
    if (cached.embeddings.has(chunk.embeddingKey)) {
      cacheHits += 1;
    } else {
      missingTextsByKey.set(chunk.embeddingKey, chunk.embeddingText);
    }
  }

  const missingKeys = [...missingTextsByKey.keys()];
  const missingVectors = missingKeys.length === 0
    ? []
    : await provider.embedDocuments([...missingTextsByKey.values()]);
  const newEmbeddings = new Map<string, number[]>();

  missingKeys.forEach((key, index) => {
    const embedding = missingVectors[index];
    if (!embedding) {
      throw new Error(`Missing embedding for key ${key}`);
    }
    newEmbeddings.set(key, embedding);
  });

  const dimensions = cached.dimensions ?? missingVectors[0]?.length;
  if (dimensions !== undefined) {
    for (const embedding of newEmbeddings.values()) {
      if (embedding.length !== dimensions) {
        throw new Error("New embeddings do not match cached dimensions");
      }
    }
    await cache.setMany(newEmbeddings, dimensions);
  }

  const allEmbeddings = new Map([
    ...cached.embeddings,
    ...newEmbeddings,
  ]);
  const embeddedChunks = chunks.map((chunk) => {
    const embedding = allEmbeddings.get(chunk.embeddingKey);
    if (!embedding) {
      throw new Error(`Embedding not found for chunk ${chunk.id}`);
    }
    return { chunk, embedding };
  });

  return {
    embeddedChunks,
    dimensions,
    cacheHits,
    cacheMisses: missingKeys.length,
  };
}
