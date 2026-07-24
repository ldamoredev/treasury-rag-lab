import type { ContextualizedChunk } from "@treasury-rag/contracts";

export type EmbeddedChunk = {
  chunk: ContextualizedChunk;
  embedding: number[];
};
