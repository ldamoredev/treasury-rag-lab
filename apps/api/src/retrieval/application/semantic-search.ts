import {
  SearchResponseSchema,
  type SearchRequest,
  type SearchResponse,
} from "@treasury-rag/contracts";

import type { DocumentChunker } from "../../chunking/domain/document-chunker.js";
import type { DocumentRepository } from "../../documents/ports/document-repository.js";
import { rankEmbeddedChunks } from "../domain/rank-embedded-chunks.js";
import { selectDocuments } from "../domain/select-documents.js";
import type { EmbeddingCache } from "../ports/embedding-cache.js";
import type { EmbeddingProvider } from "../ports/embedding-provider.js";
import type { PolicySearch } from "../ports/policy-search.js";
import type { TextHasher } from "../ports/text-hasher.js";
import { embedChunks } from "./embed-chunks.js";

export class SemanticSearch implements PolicySearch {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly chunker: DocumentChunker,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly embeddingCache: EmbeddingCache,
    private readonly textHasher: TextHasher,
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startedAt = performance.now();
    const documents = selectDocuments(this.documents.list(), {
      tenant: request.tenant,
      tenantFilterEnabled: request.config.tenantFilterEnabled,
    });
    const chunks = documents.flatMap((document) =>
      this.chunker.chunk(document, request.config.chunking)
    );
    const embedded = await embedChunks(
      chunks,
      this.embeddingProvider,
      this.embeddingCache,
      this.textHasher,
    );
    const queryEmbedding = await this.embeddingProvider.embedQuery(
      request.query,
    );
    const dimensions = embedded.dimensions ?? queryEmbedding.length;

    if (queryEmbedding.length !== dimensions) {
      throw new Error(
        "Query and document embeddings have different dimensions",
      );
    }

    const results = rankEmbeddedChunks(
      queryEmbedding,
      embedded.embeddedChunks,
      documents,
      request.config.threshold,
      request.config.topK,
    );

    return SearchResponseSchema.parse({
      query: request.query,
      results,
      stats: {
        candidateChunks: chunks.length,
        returnedChunks: results.length,
        embeddingDimensions: dimensions,
        cacheHits: embedded.cacheHits,
        cacheMisses: embedded.cacheMisses,
        durationMs: performance.now() - startedAt,
        provider: this.embeddingProvider.id,
        model: this.embeddingProvider.model,
      },
    });
  }
}
