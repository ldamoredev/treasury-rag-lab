import type {
  Chunk,
  ContextualizedChunk,
  Document,
} from "@treasury-rag/contracts";

export type ContextualizationInput = {
  document: Document;
  chunks: Chunk[];
};

/**
 * Turns chunks into retrievable units by attaching the context they lost when
 * they were cut. Implementations may be deterministic or model-backed, which
 * is why `id`, `model` and `promptVersion` are part of the contract: they
 * belong to the embedding cache key, so changing any of them invalidates the
 * vectors it produced instead of silently reusing them.
 */
export interface ChunkContextualizer {
  readonly id: string;
  readonly model: string;
  readonly promptVersion: string;
  contextualize(
    input: ContextualizationInput,
  ): Promise<ContextualizedChunk[]>;
}
