import type { Document, HeadingChunkingConfig } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { MarkdownHeadingChunker } from "../src/chunking/domain/markdown-heading-chunker.js";

const chunker = new MarkdownHeadingChunker();

function chunkByHeadings(
  document: Document,
  config: Omit<HeadingChunkingConfig, "strategy">,
) {
  return chunker.chunk(document, { strategy: "headings", ...config });
}

function documentWith(content: string): Document {
  return {
    id: "heading-document",
    title: "Heading document",
    content,
    tenant: "acme",
    version: 1,
    effectiveFrom: "2026-02-01",
  };
}

describe("chunkByHeadings", () => {
  it("packs complete adjacent sections up to the configured limit", () => {
    const content = "# A\nalpha\n## B\nbeta\n## C\ngamma";
    const chunks = chunkByHeadings(documentWith(content), {
      maxChunkSize: 22,
    });

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "# A\nalpha\n## B\nbeta\n",
      "## C\ngamma",
    ]);
  });

  it("preserves a preamble before the first heading", () => {
    const content = "Intro text\n\n# Policy\nRule";
    const chunks = chunkByHeadings(documentWith(content), {
      maxChunkSize: 100,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe(content);
  });

  it("splits an oversized section without changing the source", () => {
    const content = "# Large\n12345678901234567890";
    const chunks = chunkByHeadings(documentWith(content), {
      maxChunkSize: 10,
    });

    expect(chunks.every((chunk) => chunk.text.length <= 10)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(content);
  });

  it("treats a document without headings as contiguous source text", () => {
    const content = "A paragraph without markdown headings.";
    const chunks = chunkByHeadings(documentWith(content), {
      maxChunkSize: 12,
    });

    expect(chunks.map((chunk) => chunk.text).join("")).toBe(content);
    expect(chunks.map((chunk) => chunk.startOffset)).toEqual([0, 12, 24, 36]);
  });

  it("returns no chunks for empty content", () => {
    expect(
      chunkByHeadings(documentWith(""), { maxChunkSize: 100 }),
    ).toEqual([]);
  });
});
