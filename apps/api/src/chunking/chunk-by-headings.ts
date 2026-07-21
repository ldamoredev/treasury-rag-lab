import {
  HeadingChunkingConfigSchema,
  type Chunk,
  type Document,
  type HeadingChunkingConfig,
} from "@treasury-rag/contracts";

type Range = {
  startOffset: number;
  endOffset: number;
};

function findSectionRanges(content: string): Range[] {
  const headingPattern = /^#{1,6}[\t ]+.+$/gm;
  const headingOffsets = Array.from(content.matchAll(headingPattern), (match) =>
    match.index,
  );

  if (headingOffsets.length === 0) {
    return content.length === 0
      ? []
      : [{ startOffset: 0, endOffset: content.length }];
  }

  const starts = headingOffsets[0] === 0 ? headingOffsets : [0, ...headingOffsets];

  return starts.map((startOffset, index) => ({
    startOffset,
    endOffset: starts[index + 1] ?? content.length,
  }));
}

function splitRange(range: Range, maxChunkSize: number): Range[] {
  const ranges: Range[] = [];

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

function packSections(sections: Range[], maxChunkSize: number): Range[] {
  const packed: Range[] = [];
  let current: Range | undefined;

  const flush = () => {
    if (current) {
      packed.push(current);
      current = undefined;
    }
  };

  for (const section of sections) {
    const sectionLength = section.endOffset - section.startOffset;

    if (sectionLength > maxChunkSize) {
      flush();
      const pieces = splitRange(section, maxChunkSize);
      const finalPiece = pieces.pop();
      packed.push(...pieces);
      current = finalPiece;
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

export function chunkByHeadings(
  document: Document,
  options: Omit<HeadingChunkingConfig, "strategy">,
): Chunk[] {
  const config = HeadingChunkingConfigSchema.parse({
    strategy: "headings",
    ...options,
  });
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
