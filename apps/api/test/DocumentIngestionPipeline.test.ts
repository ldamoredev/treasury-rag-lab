import type { ChunkingConfig, Document } from "@treasury-rag/contracts";
import { beforeAll, describe, expect, it } from "vitest";

import { CharacterWindowChunker } from "../src/chunking/domain/CharacterWindowChunker.js";
import { DocumentChunker } from "../src/chunking/domain/DocumentChunker.js";
import { MarkdownHeadingChunker } from "../src/chunking/domain/MarkdownHeadingChunker.js";
import { TokenWindowChunker } from "../src/chunking/domain/TokenWindowChunker.js";
import { DocumentIngestionPipeline } from "../src/ingestion/application/DocumentIngestionPipeline.js";
import { MetadataChunkContextualizer } from "../src/ingestion/domain/MetadataChunkContextualizer.js";
import { PassthroughChunkContextualizer } from "../src/ingestion/domain/PassthroughChunkContextualizer.js";
import { Sha256TextHasher } from "../src/retrieval/infrastructure/Sha256TextHasher.js";
import { FakeTokenCounter } from "./support/FakeTokenCounter.js";

const hasher = new Sha256TextHasher();
const tokens = new FakeTokenCounter();
const chunker = new DocumentChunker([
  new CharacterWindowChunker(),
  new MarkdownHeadingChunker(),
  new TokenWindowChunker(tokens),
]);
const contextualizer = new MetadataChunkContextualizer(tokens, hasher);
const passthrough = new PassthroughChunkContextualizer(tokens, hasher);

const CHARACTERS: ChunkingConfig = {
  strategy: "characters",
  chunkSize: 120,
  overlap: 0,
};

function documentWith(content: string, id = "policy"): Document {
  return {
    id,
    title: "Política de prueba",
    content,
    tenant: "acme",
    version: 2,
    effectiveFrom: "2026-02-01",
  };
}

const CONTENT = [
  "# Política de prueba",
  "",
  "## Umbral",
  "",
  "Todo movimiento superior al umbral requiere una segunda firma.",
  "",
  "## Plazo",
  "",
  "La regularización tiene una ventana acotada de dos días hábiles.",
].join("\n");

describe("DocumentIngestionPipeline", () => {
  let pipeline: DocumentIngestionPipeline;

  beforeAll(() => {
    pipeline = new DocumentIngestionPipeline(chunker, tokens, hasher);
  });

  it("produces the same manifest when ingesting the same corpus twice", async () => {
    const documents = [documentWith(CONTENT)];

    const first = await pipeline.ingest({
      documents,
      chunking: CHARACTERS,
      contextualizer,
    });
    const second = await pipeline.ingest({
      documents,
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(JSON.stringify(second.manifest)).toBe(
      JSON.stringify(first.manifest),
    );
  });

  it("records the tokenizer and contextualizer that produced the vectors", async () => {
    const { manifest } = await pipeline.ingest({
      documents: [documentWith(CONTENT)],
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(manifest.tokenizer).toEqual({ id: tokens.id, model: tokens.model });
    expect(manifest.contextualizer).toEqual({
      id: contextualizer.id,
      model: contextualizer.model,
      promptVersion: contextualizer.promptVersion,
    });
  });

  it("changes the document content hash when the body changes", async () => {
    const original = await pipeline.ingest({
      documents: [documentWith(CONTENT)],
      chunking: CHARACTERS,
      contextualizer,
    });
    const edited = await pipeline.ingest({
      documents: [documentWith(`${CONTENT}\n\nUna regla nueva.`)],
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(edited.manifest.documents[0]!.contentHash).not.toBe(
      original.manifest.documents[0]!.contentHash,
    );
  });

  it("keeps the content hash stable when only the chunking changes", async () => {
    const documents = [documentWith(CONTENT)];

    const small = await pipeline.ingest({
      documents,
      chunking: CHARACTERS,
      contextualizer,
    });
    const large = await pipeline.ingest({
      documents,
      chunking: { strategy: "characters", chunkSize: 400, overlap: 0 },
      contextualizer,
    });

    expect(large.manifest.documents[0]!.contentHash).toBe(
      small.manifest.documents[0]!.contentHash,
    );
    expect(large.manifest.totals.chunks).not.toBe(small.manifest.totals.chunks);
  });

  it("reports token totals for every chunking strategy", async () => {
    const documents = [documentWith(CONTENT)];
    const strategies: ChunkingConfig[] = [
      CHARACTERS,
      { strategy: "headings", maxChunkSize: 120 },
      { strategy: "tokens", maxTokens: 24, overlapTokens: 0 },
    ];

    for (const chunking of strategies) {
      const { manifest } = await pipeline.ingest({
        documents,
        chunking,
        contextualizer,
      });

      expect(manifest.chunking).toEqual(chunking);
      expect(manifest.totals.chunks).toBeGreaterThan(0);
      expect(manifest.totals.embeddingTokens).toBeGreaterThan(0);
      expect(manifest.totals.documentTokens).toBe(tokens.count(CONTENT));
    }
  });

  it("keeps citation text free of contextual text", async () => {
    const { chunks } = await pipeline.ingest({
      documents: [documentWith(CONTENT)],
      chunking: CHARACTERS,
      contextualizer,
    });

    for (const chunk of chunks) {
      expect(chunk.text).toBe(
        CONTENT.slice(chunk.startOffset, chunk.endOffset),
      );
      expect(chunk.contextualPrefix.length).toBeGreaterThan(0);
      expect(chunk.embeddingText).toContain(chunk.text);
    }
  });

  it("gives distinct embedding keys to chunks with different context", async () => {
    const { chunks } = await pipeline.ingest({
      documents: [
        documentWith(CONTENT, "policy-a"),
        { ...documentWith(CONTENT, "policy-b"), version: 3 },
      ],
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(new Set(chunks.map((chunk) => chunk.embeddingKey)).size).toBe(
      chunks.length,
    );
  });

  it("shares keys between same-text chunks that differ only by tenant", async () => {
    // Follows from keeping the tenant out of the prefix: two tenants holding
    // an identical passage occupy the same point in the vector space, and
    // tenant isolation is enforced by document selection, not by the vector.
    const { chunks } = await pipeline.ingest({
      documents: [
        documentWith(CONTENT, "policy-a"),
        { ...documentWith(CONTENT, "policy-b"), tenant: "boreal" as const },
      ],
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(new Set(chunks.map((chunk) => chunk.embeddingKey)).size).toBe(
      chunks.length / 2,
    );
  });

  it("shares one embedding key between chunks whose context and text match", async () => {
    // Two indistinguishable chunks describe the same point in the same
    // vector space. Reusing the vector is the embedding cache doing its job,
    // not a collision: retrieval still ranks each chunk on its own metadata.
    const { chunks } = await pipeline.ingest({
      documents: [
        documentWith(CONTENT, "policy-a"),
        documentWith(CONTENT, "policy-b"),
      ],
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(new Set(chunks.map((chunk) => chunk.embeddingKey)).size).toBe(
      chunks.length / 2,
    );
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
  });

  it("reuses the plain text key when contextualization is disabled", async () => {
    const { chunks, manifest } = await pipeline.ingest({
      documents: [documentWith(CONTENT)],
      chunking: CHARACTERS,
      contextualizer: passthrough,
    });

    expect(manifest.contextualizer.id).toBe("none");
    for (const chunk of chunks) {
      expect(chunk.embeddingKey).toBe(hasher.hash(chunk.text));
    }
  });

  it("ingests an empty corpus without producing chunks", async () => {
    const { chunks, manifest } = await pipeline.ingest({
      documents: [],
      chunking: CHARACTERS,
      contextualizer,
    });

    expect(chunks).toEqual([]);
    expect(manifest.totals).toEqual({
      documents: 0,
      chunks: 0,
      documentTokens: 0,
      embeddingTokens: 0,
    });
  });
});
