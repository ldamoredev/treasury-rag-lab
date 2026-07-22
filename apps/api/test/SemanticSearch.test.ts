import type { Document } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { CharacterWindowChunker } from "../src/chunking/domain/CharacterWindowChunker.js";
import { DocumentChunker } from "../src/chunking/domain/DocumentChunker.js";
import { MarkdownHeadingChunker } from "../src/chunking/domain/MarkdownHeadingChunker.js";
import type { DocumentRepository } from "../src/documents/ports/DocumentRepository.js";
import { SemanticSearch } from "../src/retrieval/application/SemanticSearch.js";
import { Sha256TextHasher } from "../src/retrieval/infrastructure/Sha256TextHasher.js";
import { FakeEmbeddingProvider } from "./support/FakeEmbeddingProvider.js";
import { MemoryEmbeddingCache } from "./support/MemoryEmbeddingCache.js";

const documents: Document[] = [
  {
    id: "global-policy",
    title: "Global policy",
    content: "A partial payment leaves the invoice open.",
    tenant: "global",
    version: 1,
    effectiveFrom: "2026-01-01",
  },
  {
    id: "acme-policy",
    title: "Acme policy",
    content: "Acme requires human approval for every partial payment.",
    tenant: "acme",
    version: 1,
    effectiveFrom: "2026-01-01",
  },
  {
    id: "boreal-policy",
    title: "Boreal policy",
    content: "Boreal allows automatic matching.",
    tenant: "boreal",
    version: 1,
    effectiveFrom: "2026-01-01",
  },
];

const repository: DocumentRepository = {
  list: () => documents.map((document) => ({ ...document })),
  findById: (id) => documents.find((document) => document.id === id),
};

function createFixture() {
  const provider = new FakeEmbeddingProvider({
    documents: {
      [documents[0]!.content]: [1, 0],
      [documents[1]!.content]: [0.9, 0.1],
      [documents[2]!.content]: [0, 1],
    },
    queries: {
      "Does an incomplete payment close the invoice?": [1, 0],
    },
  });
  const cache = new MemoryEmbeddingCache();
  const service = new SemanticSearch(
    repository,
    new DocumentChunker([
      new CharacterWindowChunker(),
      new MarkdownHeadingChunker(),
    ]),
    provider,
    cache,
    new Sha256TextHasher(),
  );
  return { service, provider };
}

const baseRequest = {
  query: "Does an incomplete payment close the invoice?",
  tenant: "acme" as const,
  config: {
    chunking: { strategy: "headings" as const, maxChunkSize: 500 },
    topK: 5,
    threshold: -1,
    tenantFilterEnabled: true,
  },
};

describe("search service", () => {
  it("ranks semantic results and excludes another tenant", async () => {
    const { service } = createFixture();
    const response = await service.search(baseRequest);

    expect(response.results.map((result) => result.documentId)).toEqual([
      "global-policy",
      "acme-policy",
    ]);
    expect(response.results[0]?.score).toBeCloseTo(1);
    expect(response.stats.candidateChunks).toBe(2);
    expect(response.stats.cacheMisses).toBe(2);
  });

  it("makes tenant leakage observable when filtering is disabled", async () => {
    const { service } = createFixture();
    const response = await service.search({
      ...baseRequest,
      config: { ...baseRequest.config, tenantFilterEnabled: false },
    });

    expect(response.results.map((result) => result.documentId)).toContain(
      "boreal-policy",
    );
  });

  it("applies threshold and top-k after scoring", async () => {
    const { service } = createFixture();
    const response = await service.search({
      ...baseRequest,
      config: { ...baseRequest.config, threshold: 0.999, topK: 1 },
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.documentId).toBe("global-policy");
  });

  it("reuses cached document embeddings on the second search", async () => {
    const { service, provider } = createFixture();
    await service.search(baseRequest);
    const second = await service.search(baseRequest);

    expect(second.stats.cacheHits).toBe(2);
    expect(second.stats.cacheMisses).toBe(0);
    expect(provider.documentCalls).toBe(1);
  });
});
