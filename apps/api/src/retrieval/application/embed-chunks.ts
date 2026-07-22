import type { Chunk } from "@treasury-rag/contracts";

import type { EmbeddedChunk } from "../domain/embedded-chunk.js";
import type { EmbeddingCache } from "../ports/embedding-cache.js";
import type { EmbeddingProvider } from "../ports/embedding-provider.js";
import type { TextHasher } from "../ports/text-hasher.js";

export type EmbedChunksResult = {
  embeddedChunks: EmbeddedChunk[];
  dimensions: number | undefined;
  cacheHits: number;
  cacheMisses: number;
};

export async function embedChunks(
  chunks: Chunk[],
  provider: EmbeddingProvider,
  cache: EmbeddingCache,
  hasher: TextHasher,
): Promise<EmbedChunksResult> {
  const hashes = chunks.map((chunk) => hasher.hash(chunk.text));
  const cached = await cache.getMany([...new Set(hashes)]);
  const missingTextsByHash = new Map<string, string>();
  let cacheHits = 0;

  chunks.forEach((chunk, index) => {
    const hash = hashes[index];
    if (!hash) {
      return;
    }
    if (cached.embeddings.has(hash)) {
      cacheHits += 1;
    } else {
      missingTextsByHash.set(hash, chunk.text);
    }
  });

  const missingHashes = [...missingTextsByHash.keys()];
  const missingVectors = missingHashes.length === 0
    ? []
    : await provider.embedDocuments([...missingTextsByHash.values()]);
  const newEmbeddings = new Map<string, number[]>();

  missingHashes.forEach((hash, index) => {
    const embedding = missingVectors[index];
    if (!embedding) {
      throw new Error(`Missing embedding for hash ${hash}`);
    }
    newEmbeddings.set(hash, embedding);
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
  const embeddedChunks = chunks.map((chunk, index) => {
    const hash = hashes[index];
    const embedding = hash ? allEmbeddings.get(hash) : undefined;
    if (!embedding) {
      throw new Error(`Embedding not found for chunk ${chunk.id}`);
    }
    return { chunk, embedding };
  });

  return {
    embeddedChunks,
    dimensions,
    cacheHits,
    cacheMisses: missingHashes.length,
  };
}
