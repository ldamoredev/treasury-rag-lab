import type { Chunk, Document } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { CharacterWindowChunker } from "../src/chunking/domain/CharacterWindowChunker.js";
import { MetadataChunkContextualizer } from "../src/ingestion/domain/MetadataChunkContextualizer.js";
import { PassthroughChunkContextualizer } from "../src/ingestion/domain/PassthroughChunkContextualizer.js";
import { Sha256TextHasher } from "../src/retrieval/infrastructure/Sha256TextHasher.js";
import { FakeTokenCounter } from "./support/FakeTokenCounter.js";

const CONTENT = [
  "# Retenciones — Boreal",
  "",
  "## Tolerancia de diferencias",
  "",
  "La diferencia se considera aceptable.",
].join("\n");

const document: Document = {
  id: "boreal-withholdings",
  title: "Retenciones impositivas — Boreal",
  content: CONTENT,
  tenant: "boreal",
  version: 3,
  effectiveFrom: "2026-04-01",
};

const hasher = new Sha256TextHasher();
const tokens = new FakeTokenCounter();

function contextualizer(promptVersion?: string) {
  return new MetadataChunkContextualizer(tokens, hasher, promptVersion);
}

function ambiguousChunk(): Chunk {
  const startOffset = CONTENT.indexOf("La diferencia");
  return {
    id: "boreal-withholdings:characters:300:0:1",
    documentId: document.id,
    text: CONTENT.slice(startOffset),
    index: 1,
    tenant: document.tenant,
    version: document.version,
    effectiveFrom: document.effectiveFrom,
    startOffset,
    endOffset: CONTENT.length,
  };
}

describe("MetadataChunkContextualizer", () => {
  it("prefixes a chunk with its document title, version and heading path", async () => {
    const [contextualized] = await contextualizer().contextualize({
      document,
      chunks: [ambiguousChunk()],
    });

    expect(contextualized!.contextualPrefix).toContain(
      "Retenciones impositivas — Boreal",
    );
    expect(contextualized!.contextualPrefix).toContain("v3");
    expect(contextualized!.contextualPrefix).toContain(
      "Tolerancia de diferencias",
    );
  });

  it("keeps the tenant out of the prefix because a filter already enforces it", async () => {
    // Measured decision, not a style choice: adding `tenant: boreal` to the
    // prefix dropped dataset recall@k from 92% to 83%, because a question
    // naming a tenant began outranking the global rule that answered it.
    // Tenant isolation is decided in document selection, before ranking.
    const [contextualized] = await contextualizer().contextualize({
      document,
      chunks: [ambiguousChunk()],
    });

    expect(contextualized!.contextualPrefix).not.toContain("tenant");
    expect(contextualized!.contextualPrefix).not.toContain("boreal");
  });

  it("never alters the original chunk text used for citations", async () => {
    const chunk = ambiguousChunk();

    const [contextualized] = await contextualizer().contextualize({
      document,
      chunks: [chunk],
    });

    expect(contextualized!.text).toBe(chunk.text);
    expect(contextualized!.text).toBe(
      CONTENT.slice(chunk.startOffset, chunk.endOffset),
    );
    expect(contextualized!.text).not.toContain(
      contextualized!.contextualPrefix,
    );
  });

  it("builds the prefix only from validated metadata and literal document headings", async () => {
    const [contextualized] = await contextualizer().contextualize({
      document,
      chunks: [ambiguousChunk()],
    });

    // Every value in the prefix must come from validated metadata or appear
    // verbatim in the document. Labels and separators are formatting, so the
    // assertion inspects the values only.
    const values = contextualized!.contextualPrefix
      .replace(/^\[|\]$/g, "")
      .split("·")
      .flatMap((field) => field.split(":").slice(1).join(":").split("›"))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      const known = value === document.title
        || value === document.tenant
        || value === `v${document.version}`
        || value === document.effectiveFrom
        || CONTENT.includes(value);
      expect(known, `unexpected generated text: ${value}`).toBe(true);
    }
  });

  it("puts the prefix in front of the original text inside the embedding text", async () => {
    const chunk = ambiguousChunk();

    const [contextualized] = await contextualizer().contextualize({
      document,
      chunks: [chunk],
    });

    expect(contextualized!.embeddingText).toBe(
      `${contextualized!.contextualPrefix}\n${chunk.text}`,
    );
  });

  it("produces the same prefix and key for the same chunk across runs", async () => {
    const input = { document, chunks: [ambiguousChunk()] };

    expect(await contextualizer().contextualize(input)).toEqual(
      await contextualizer().contextualize(input),
    );
  });

  it("changes the embedding key when the prompt version changes", async () => {
    const input = { document, chunks: [ambiguousChunk()] };

    const [first] = await contextualizer("v1").contextualize(input);
    const [second] = await contextualizer("v2").contextualize(input);

    expect(first!.embeddingText).toBe(second!.embeddingText);
    expect(first!.embeddingKey).not.toBe(second!.embeddingKey);
  });

  it("gives two chunks of the same document different keys", async () => {
    const chunks = new CharacterWindowChunker().chunk(document, {
      strategy: "characters",
      chunkSize: 40,
      overlap: 0,
    });

    const contextualized = await contextualizer().contextualize({
      document,
      chunks,
    });
    const keys = new Set(contextualized.map((chunk) => chunk.embeddingKey));

    expect(keys.size).toBe(contextualized.length);
  });
});

describe("PassthroughChunkContextualizer", () => {
  const passthrough = new PassthroughChunkContextualizer(tokens, hasher);

  it("leaves the embedding text identical to the chunk text", async () => {
    const chunk = ambiguousChunk();

    const [contextualized] = await passthrough.contextualize({
      document,
      chunks: [chunk],
    });

    expect(contextualized!.contextualPrefix).toBe("");
    expect(contextualized!.embeddingText).toBe(chunk.text);
  });

  it("keys the embedding by chunk text alone so existing vectors stay valid", async () => {
    const chunk = ambiguousChunk();

    const [contextualized] = await passthrough.contextualize({
      document,
      chunks: [chunk],
    });

    expect(contextualized!.embeddingKey).toBe(hasher.hash(chunk.text));
  });
});
