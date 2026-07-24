import { CharacterWindowChunker } from "../../src/chunking/domain/CharacterWindowChunker.js";
import { DocumentChunker } from "../../src/chunking/domain/DocumentChunker.js";
import { MarkdownHeadingChunker } from "../../src/chunking/domain/MarkdownHeadingChunker.js";
import { TokenWindowChunker } from "../../src/chunking/domain/TokenWindowChunker.js";
import type { DocumentRepository } from "../../src/documents/ports/DocumentRepository.js";
import { DocumentIngestionPipeline } from "../../src/ingestion/application/DocumentIngestionPipeline.js";
import { MetadataChunkContextualizer } from "../../src/ingestion/domain/MetadataChunkContextualizer.js";
import { PassthroughChunkContextualizer } from "../../src/ingestion/domain/PassthroughChunkContextualizer.js";
import { SemanticSearch } from "../../src/retrieval/application/SemanticSearch.js";
import { Sha256TextHasher } from "../../src/retrieval/infrastructure/Sha256TextHasher.js";
import type { EmbeddingCache } from "../../src/retrieval/ports/EmbeddingCache.js";
import type { EmbeddingProvider } from "../../src/retrieval/ports/EmbeddingProvider.js";
import { FakeTokenCounter } from "./FakeTokenCounter.js";

/**
 * Assembles the real retrieval graph with fake providers. Tests that measure
 * ranking, caching or contextualization run through the same object wiring as
 * production, so a wiring mistake fails a test instead of only production.
 */
export function createSemanticSearch(
  documents: DocumentRepository,
  provider: EmbeddingProvider,
  cache: EmbeddingCache,
): SemanticSearch {
  const hasher = new Sha256TextHasher();
  const tokens = new FakeTokenCounter();
  const chunker = new DocumentChunker([
    new CharacterWindowChunker(),
    new MarkdownHeadingChunker(),
    new TokenWindowChunker(tokens),
  ]);

  return new SemanticSearch(
    documents,
    new DocumentIngestionPipeline(chunker, tokens, hasher),
    tokens,
    {
      enabled: new MetadataChunkContextualizer(tokens, hasher),
      disabled: new PassthroughChunkContextualizer(tokens, hasher),
    },
    provider,
    cache,
  );
}
