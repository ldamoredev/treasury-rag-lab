import { performance } from "node:perf_hooks";

import {
  SearchResponseSchema,
  type SearchRequest,
  type SearchResponse,
} from "@treasury-rag/contracts";

import { chunkDocument } from "../chunking/chunk-document.js";
import { embedChunks } from "../embeddings/embed-chunks.js";
import type { EmbeddingCache } from "../embeddings/embedding-cache.js";
import type { EmbeddingProvider } from "../embeddings/embedding-provider.js";
import type { DocumentRepository } from "../documents/repository.js";
import { cosineSimilarity } from "./cosine-similarity.js";

export interface SearchService {
  search(request: SearchRequest): Promise<SearchResponse>;
}

type SearchServiceDependencies = {
  documentRepository: DocumentRepository;
  embeddingProvider: EmbeddingProvider;
  embeddingCache: EmbeddingCache;
};

export function createSearchService({
  documentRepository,
  embeddingProvider,
  embeddingCache,
}: SearchServiceDependencies): SearchService {
  return {
    async search(request) {
      const startedAt = performance.now();
      const documents = documentRepository.list().filter((document) => {
        if (!request.config.tenantFilterEnabled) {
          return true;
        }
        return document.tenant === "global" || document.tenant === request.tenant;
      });
      const documentsById = new Map(
        documents.map((document) => [document.id, document]),
      );
      const chunks = documents.flatMap((document) =>
        chunkDocument(document, request.config.chunking),
      );
      const embedded = await embedChunks(
        chunks,
        embeddingProvider,
        embeddingCache,
      );
      const queryEmbedding = await embeddingProvider.embedQuery(request.query);
      const dimensions = embedded.dimensions ?? queryEmbedding.length;

      if (queryEmbedding.length !== dimensions) {
        throw new Error("Query and document embeddings have different dimensions");
      }

      const ranked = embedded.embeddedChunks
        .map(({ chunk, embedding }) => ({
          chunk,
          score: cosineSimilarity(queryEmbedding, embedding),
        }))
        .filter(({ score }) => score >= request.config.threshold)
        .sort((left, right) =>
          right.score - left.score || left.chunk.id.localeCompare(right.chunk.id),
        )
        .slice(0, request.config.topK)
        .map(({ chunk, score }, index) => {
          const document = documentsById.get(chunk.documentId);
          if (!document) {
            throw new Error(`Document ${chunk.documentId} not found for search result`);
          }

          return {
            rank: index + 1,
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentTitle: document.title,
            tenant: chunk.tenant,
            version: chunk.version,
            effectiveFrom: chunk.effectiveFrom,
            score,
            text: chunk.text,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
          };
        });

      return SearchResponseSchema.parse({
        query: request.query,
        results: ranked,
        stats: {
          candidateChunks: chunks.length,
          returnedChunks: ranked.length,
          embeddingDimensions: dimensions,
          cacheHits: embedded.cacheHits,
          cacheMisses: embedded.cacheMisses,
          durationMs: performance.now() - startedAt,
          provider: embeddingProvider.id,
          model: embeddingProvider.model,
        },
      });
    },
  };
}
