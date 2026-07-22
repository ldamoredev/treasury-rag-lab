import type {
  Chunk,
  ChunkingConfig,
  Document,
} from "@treasury-rag/contracts";

import type { ChunkingStrategy } from "./chunking-strategy.js";

export class DocumentChunker {
  private readonly strategies: ReadonlyMap<
    ChunkingConfig["strategy"],
    ChunkingStrategy
  >;

  constructor(strategies: ChunkingStrategy[]) {
    this.strategies = new Map(
      strategies.map((strategy) => [strategy.strategy, strategy]),
    );
  }

  chunk(document: Document, config: ChunkingConfig): Chunk[] {
    const strategy = this.strategies.get(config.strategy);
    if (!strategy) {
      throw new Error(`No chunking strategy registered for ${config.strategy}`);
    }
    return strategy.chunk(document, config);
  }
}
