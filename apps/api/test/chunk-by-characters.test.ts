import type { CharacterChunkingConfig, Document } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { CharacterWindowChunker } from "../src/chunking/domain/character-window-chunker.js";

const chunker = new CharacterWindowChunker();

function chunkByCharacters(
  document: Document,
  config: Omit<CharacterChunkingConfig, "strategy">,
) {
  return chunker.chunk(document, { strategy: "characters", ...config });
}

function documentWith(content: string): Document {
  return {
    id: "test-document",
    title: "Test document",
    content,
    tenant: "global",
    version: 2,
    effectiveFrom: "2026-01-15",
  };
}

describe("chunkByCharacters", () => {
  it("creates deterministic overlapping chunks without a redundant tail", () => {
    const chunks = chunkByCharacters(documentWith("ABCDEFGHIJ"), {
      chunkSize: 4,
      overlap: 1,
    });

    expect(chunks.map(({ text, startOffset, endOffset }) => ({
      text,
      startOffset,
      endOffset,
    }))).toEqual([
      { text: "ABCD", startOffset: 0, endOffset: 4 },
      { text: "DEFG", startOffset: 3, endOffset: 7 },
      { text: "GHIJ", startOffset: 6, endOffset: 10 },
    ]);
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      "test-document:characters:4:1:0",
      "test-document:characters:4:1:1",
      "test-document:characters:4:1:2",
    ]);
  });

  it("returns one chunk when the document fits exactly", () => {
    const chunks = chunkByCharacters(documentWith("ABCD"), {
      chunkSize: 4,
      overlap: 0,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("ABCD");
  });

  it("returns no chunks for an empty document", () => {
    expect(
      chunkByCharacters(documentWith(""), { chunkSize: 10, overlap: 2 }),
    ).toEqual([]);
  });

  it("preserves document metadata and exact source slices", () => {
    const document = documentWith("one two three four");
    const chunks = chunkByCharacters(document, {
      chunkSize: 8,
      overlap: 3,
    });

    for (const [index, chunk] of chunks.entries()) {
      expect(chunk.index).toBe(index);
      expect(chunk.tenant).toBe(document.tenant);
      expect(chunk.version).toBe(document.version);
      expect(chunk.effectiveFrom).toBe(document.effectiveFrom);
      expect(chunk.text).toBe(
        document.content.slice(chunk.startOffset, chunk.endOffset),
      );
    }
  });

  it("rejects overlap equal to or greater than chunk size", () => {
    expect(() =>
      chunkByCharacters(documentWith("text"), {
        chunkSize: 4,
        overlap: 4,
      }),
    ).toThrow(/overlap must be smaller than chunkSize/);
  });
});
