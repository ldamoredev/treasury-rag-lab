import type { Chunk } from "@treasury-rag/contracts";

export type EmbeddedChunk = {
  chunk: Chunk;
  embedding: number[];
};
