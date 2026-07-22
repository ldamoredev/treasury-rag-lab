import {
  HeadingChunkingConfigSchema,
  type Chunk,
  type ChunkingConfig,
  type Document,
} from "@treasury-rag/contracts";

import type { ChunkingStrategy } from "./ChunkingStrategy.js";

type SourceRange = {
  startOffset: number;
  endOffset: number;
};

function findSectionRanges(content: string): SourceRange[] {
  const headingPattern = /^#{1,6}[\t ]+.+$/gm;
  const headingOffsets = Array.from(content.matchAll(headingPattern), (match) =>
    match.index,
  );

  if (headingOffsets.length === 0) {
    return content.length === 0
      ? []
      : [{ startOffset: 0, endOffset: content.length }];
  }

  const starts = headingOffsets[0] === 0
    ? headingOffsets
    : [0, ...headingOffsets];

  return starts.map((startOffset, index) => ({
    startOffset,
    endOffset: starts[index + 1] ?? content.length,
  }));
}

function splitRange(range: SourceRange, maxChunkSize: number): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (
    let startOffset = range.startOffset;
    startOffset < range.endOffset;
    startOffset += maxChunkSize
  ) {
    ranges.push({
      startOffset,
      endOffset: Math.min(startOffset + maxChunkSize, range.endOffset),
    });
  }
  return ranges;
}

function packSections(
  sections: SourceRange[],
  maxChunkSize: number,
): SourceRange[] {
  const packed: SourceRange[] = [];
  let current: SourceRange | undefined;

  const flush = () => {
    if (current) {
      packed.push(current);
      current = undefined;
    }
  };

  for (const section of sections) {
    if (section.endOffset - section.startOffset > maxChunkSize) {
      flush();
      const pieces = splitRange(section, maxChunkSize);
      current = pieces.pop();
      packed.push(...pieces);
      continue;
    }

    if (!current) {
      current = section;
      continue;
    }

    if (section.endOffset - current.startOffset <= maxChunkSize) {
      current = { ...current, endOffset: section.endOffset };
      continue;
    }

    flush();
    current = section;
  }

  flush();
  return packed;
}

export class MarkdownHeadingChunker implements ChunkingStrategy {
  readonly strategy = "headings" as const;

  chunk(document: Document, candidate: ChunkingConfig): Chunk[] {
    const config = HeadingChunkingConfigSchema.parse(candidate);
    const ranges = packSections(
      findSectionRanges(document.content),
      config.maxChunkSize,
    );

    return ranges.map(({ startOffset, endOffset }, index) => ({
      id: `${document.id}:headings:${config.maxChunkSize}:${index}`,
      documentId: document.id,
      text: document.content.slice(startOffset, endOffset),
      index,
      tenant: document.tenant,
      version: document.version,
      effectiveFrom: document.effectiveFrom,
      startOffset,
      endOffset,
    }));
  }
}
