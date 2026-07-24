import type {
  ChunkingConfig,
  ContextualizedChunk,
  Document,
} from "@treasury-rag/contracts";

import type { DocumentChunker } from "../../chunking/domain/DocumentChunker.js";
import type { TextHasher } from "../../retrieval/ports/TextHasher.js";
import {
  buildIngestionManifest,
  type IngestionManifest,
} from "../domain/ingestionManifest.js";
import type { ChunkContextualizer } from "../ports/ChunkContextualizer.js";
import type { TokenCounter } from "../ports/TokenCounter.js";

export type IngestionRequest = {
  documents: Document[];
  chunking: ChunkingConfig;
  contextualizer: ChunkContextualizer;
};

export type IngestionResult = {
  chunks: ContextualizedChunk[];
  manifest: IngestionManifest;
};

/**
 * Runs one pass of ingestion: parse-time documents in, retrievable chunks
 * plus a manifest out. The pipeline owns the order of the stages — chunk,
 * then contextualize, then account for what was produced — and nothing else.
 * The strategies, the tokenizer and the contextualizer stay replaceable.
 *
 * Ingestion is idempotent by construction: it derives everything from the
 * document content and the configuration, and keeps no state between runs.
 */
export class DocumentIngestionPipeline {
  constructor(
    private readonly chunker: DocumentChunker,
    private readonly tokens: TokenCounter,
    private readonly hasher: TextHasher,
  ) {}

  async ingest(request: IngestionRequest): Promise<IngestionResult> {
    const ingested = [];

    for (const document of request.documents) {
      const chunks = await request.contextualizer.contextualize({
        document,
        chunks: this.chunker.chunk(document, request.chunking),
      });
      ingested.push({
        document,
        contentHash: this.hasher.hash(document.content),
        documentTokens: this.tokens.count(document.content),
        chunks,
      });
    }

    return {
      chunks: ingested.flatMap((entry) => entry.chunks),
      manifest: buildIngestionManifest({
        chunking: request.chunking,
        tokenizer: { id: this.tokens.id, model: this.tokens.model },
        contextualizer: {
          id: request.contextualizer.id,
          model: request.contextualizer.model,
          promptVersion: request.contextualizer.promptVersion,
        },
        documents: ingested,
      }),
    };
  }
}
