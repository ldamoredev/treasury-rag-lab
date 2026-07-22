import type {
  Chunk,
  ChunkingConfig,
  Document,
} from "@treasury-rag/contracts";

export interface ChunkingStrategy {
  readonly strategy: ChunkingConfig["strategy"];
  chunk(document: Document, config: ChunkingConfig): Chunk[];
}
