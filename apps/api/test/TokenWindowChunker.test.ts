import type { Document, TokenChunkingConfig } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { TokenWindowChunker } from "../src/chunking/domain/TokenWindowChunker.js";
import { FakeTokenCounter } from "./support/FakeTokenCounter.js";

const tokens = new FakeTokenCounter();
const chunker = new TokenWindowChunker(tokens);

function chunkByTokens(
  document: Document,
  config: Omit<TokenChunkingConfig, "strategy">,
) {
  return chunker.chunk(document, { strategy: "tokens", ...config });
}

function documentWith(content: string): Document {
  return {
    id: "token-document",
    title: "Token document",
    content,
    tenant: "acme",
    version: 1,
    effectiveFrom: "2026-02-01",
  };
}

describe("TokenWindowChunker", () => {
  it("cuts at the configured token budget instead of a character budget", () => {
    const content = "# T\n" + "palabra ".repeat(40).trim();

    const chunks = chunkByTokens(documentWith(content), {
      maxTokens: 12,
      overlapTokens: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(tokens.count(chunk.text)).toBeLessThanOrEqual(12);
    }
  });

  it("keeps chunk text as an exact slice of the source document", () => {
    const content = "# Política\nRegla uno.\n## Otra\nRegla dos y tres.";

    for (
      const chunk of chunkByTokens(documentWith(content), {
        maxTokens: 6,
        overlapTokens: 2,
      })
    ) {
      expect(chunk.text).toBe(
        content.slice(chunk.startOffset, chunk.endOffset),
      );
    }
  });

  it("starts a new chunk at each heading when the section fits the budget", () => {
    const content = "# A\nalfa\n## B\nbeta\n## C\ngama";

    const chunks = chunkByTokens(documentWith(content), {
      maxTokens: 6,
      overlapTokens: 0,
    });

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "# A\nalfa\n",
      "## B\nbeta\n",
      "## C\ngama",
    ]);
  });

  it("splits an oversized section into overlapping token windows", () => {
    const content = "# T\n" + "uno dos tres cuatro cinco seis siete ocho nueve";

    const chunks = chunkByTokens(documentWith(content), {
      maxTokens: 6,
      overlapTokens: 2,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]!.startOffset).toBeLessThan(chunks[0]!.endOffset);
  });

  it("covers the whole document across consecutive chunks", () => {
    const content = "# T\nuno dos tres cuatro cinco seis siete ocho nueve diez";

    const chunks = chunkByTokens(documentWith(content), {
      maxTokens: 5,
      overlapTokens: 1,
    });

    expect(chunks[0]!.startOffset).toBe(0);
    expect(chunks.at(-1)!.endOffset).toBe(content.length);
    for (const [index, chunk] of chunks.entries()) {
      if (index > 0) {
        expect(chunk.startOffset).toBeLessThanOrEqual(
          chunks[index - 1]!.endOffset,
        );
      }
    }
  });

  it("produces deterministic IDs and offsets across two runs", () => {
    const document = documentWith("# A\nuno dos tres\n## B\ncuatro cinco seis");
    const config = { maxTokens: 7, overlapTokens: 2 } as const;

    expect(chunkByTokens(document, config)).toEqual(
      chunkByTokens(document, config),
    );
  });

  it("makes progress when a single word exceeds the token budget", () => {
    const content = "abcdefghijklmnopqrstuvwxyz";

    const chunks = chunkByTokens(documentWith(content), {
      maxTokens: 8,
      overlapTokens: 4,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.at(-1)!.endOffset).toBe(content.length);
  });

  it("returns no chunks for empty content", () => {
    expect(
      chunkByTokens(documentWith(""), { maxTokens: 32, overlapTokens: 8 }),
    ).toEqual([]);
  });
});
