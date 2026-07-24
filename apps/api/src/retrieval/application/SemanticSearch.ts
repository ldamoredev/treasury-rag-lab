import {
  SearchResponseSchema,
  type SearchRequest,
  type SearchResponse,
} from "@treasury-rag/contracts";

import type { DocumentRepository } from "../../documents/ports/DocumentRepository.js";
import type { DocumentIngestionPipeline } from "../../ingestion/application/DocumentIngestionPipeline.js";
import type { ChunkContextualizer } from "../../ingestion/ports/ChunkContextualizer.js";
import type { TokenCounter } from "../../ingestion/ports/TokenCounter.js";
import { rankEmbeddedChunks } from "../domain/rankEmbeddedChunks.js";
import { selectDocuments } from "../domain/selectDocuments.js";
import { selectLatestDocumentVersions } from "../domain/selectLatestDocumentVersions.js";
import type { EmbeddingCache } from "../ports/EmbeddingCache.js";
import type { EmbeddingProvider } from "../ports/EmbeddingProvider.js";
import type { PolicySearch } from "../ports/PolicySearch.js";
import { embedChunks } from "./embedChunks.js";

/**
 * Contextualization is a swappable policy, not a flag inside the use case:
 * both modes are real objects, so the disabled path is exercised by the same
 * code as the enabled one and stays a supported configuration.
 */
export type SemanticSearchContextualizers = {
  enabled: ChunkContextualizer;
  disabled: ChunkContextualizer;
};

export class SemanticSearch implements PolicySearch {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly ingestion: DocumentIngestionPipeline,
    private readonly tokens: TokenCounter,
    private readonly contextualizers: SemanticSearchContextualizers,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly embeddingCache: EmbeddingCache,
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startedAt = performance.now();
    // The tokenizer is a loaded resource, not a pure function. Chunking stays
    // synchronous, so it is made ready before any strategy needs to count.
    await this.tokens.load();

    const tenantDocuments = selectDocuments(this.documents.list(), {
      tenant: request.tenant,
      tenantFilterEnabled: request.config.tenantFilterEnabled,
    });
    const documents = request.config.latestVersionOnly
      ? selectLatestDocumentVersions(tenantDocuments)
      : tenantDocuments;
    const contextualizer = request.config.contextualIngestion
      ? this.contextualizers.enabled
      : this.contextualizers.disabled;

    const { chunks } = await this.ingestion.ingest({
      documents,
      chunking: request.config.chunking,
      contextualizer,
    });
    const embedded = await embedChunks(
      chunks,
      this.embeddingProvider,
      this.embeddingCache,
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
        contextualizer: contextualizer.id,
        tokenizer: this.tokens.model,
      },
    });
  }
}
