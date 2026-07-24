import {
  TokenChunkingConfigSchema,
  type Chunk,
  type ChunkingConfig,
  type Document,
} from "@treasury-rag/contracts";

import {
  findSectionRanges,
  type SourceRange,
} from "../../ingestion/domain/markdownStructure.js";
import type { TokenCounter } from "../../ingestion/ports/TokenCounter.js";
import type { ChunkingStrategy } from "./ChunkingStrategy.js";

/**
 * Cuts a document by token budget while preferring Markdown section
 * boundaries. Windows are located by searching for the character offset whose
 * prefix fits the budget, so every chunk stays an exact slice of the source:
 * the token count decides *where* to cut, never *what* the text is.
 */
export class TokenWindowChunker implements ChunkingStrategy {
  readonly strategy = "tokens" as const;

  constructor(private readonly tokens: TokenCounter) {}

  chunk(document: Document, candidate: ChunkingConfig): Chunk[] {
    const config = TokenChunkingConfigSchema.parse(candidate);
    const content = document.content;
    const ranges = this.packSections(
      findSectionRanges(content),
      content,
      config.maxTokens,
      config.overlapTokens,
    );

    return ranges.map(({ startOffset, endOffset }, index) => ({
      id: `${document.id}:tokens:${config.maxTokens}:${config.overlapTokens}:${index}`,
      documentId: document.id,
      text: content.slice(startOffset, endOffset),
      index,
      tenant: document.tenant,
      version: document.version,
      effectiveFrom: document.effectiveFrom,
      startOffset,
      endOffset,
    }));
  }

  private packSections(
    sections: SourceRange[],
    content: string,
    maxTokens: number,
    overlapTokens: number,
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
      if (this.countRange(content, section) > maxTokens) {
        flush();
        const windows = this.splitRange(
          content,
          section,
          maxTokens,
          overlapTokens,
        );
        current = windows.pop();
        packed.push(...windows);
        continue;
      }

      if (!current) {
        current = section;
        continue;
      }

      const merged = { ...current, endOffset: section.endOffset };
      if (this.countRange(content, merged) <= maxTokens) {
        current = merged;
        continue;
      }

      flush();
      current = section;
    }

    flush();
    return packed;
  }

  private splitRange(
    content: string,
    range: SourceRange,
    maxTokens: number,
    overlapTokens: number,
  ): SourceRange[] {
    const windows: SourceRange[] = [];
    let startOffset = range.startOffset;

    while (startOffset < range.endOffset) {
      const endOffset = this.findWindowEnd(
        content,
        startOffset,
        range.endOffset,
        maxTokens,
      );
      windows.push({ startOffset, endOffset });

      if (endOffset >= range.endOffset) {
        break;
      }

      const nextStart = overlapTokens === 0
        ? endOffset
        : this.findOverlapStart(content, startOffset, endOffset, overlapTokens);
      // A window must always consume source, otherwise an unbreakable span
      // would loop forever.
      startOffset = nextStart > startOffset ? nextStart : endOffset;
    }

    return windows;
  }

  /** Largest offset whose slice from `startOffset` still fits the budget. */
  private findWindowEnd(
    content: string,
    startOffset: number,
    limit: number,
    maxTokens: number,
  ): number {
    if (this.countRange(content, { startOffset, endOffset: limit }) <= maxTokens) {
      return limit;
    }

    let low = startOffset + 1;
    let high = limit;
    let best = startOffset + 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (
        this.countRange(content, { startOffset, endOffset: middle })
          <= maxTokens
      ) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return alignToWordEnd(content, startOffset, best);
  }

  /** Smallest offset whose slice up to `endOffset` still fits the overlap. */
  private findOverlapStart(
    content: string,
    lowerBound: number,
    endOffset: number,
    overlapTokens: number,
  ): number {
    let low = lowerBound;
    let high = endOffset;
    let best = endOffset;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (
        this.countRange(content, { startOffset: middle, endOffset })
          <= overlapTokens
      ) {
        best = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }

    return alignToWordStart(content, best, endOffset);
  }

  private countRange(content: string, range: SourceRange): number {
    return this.tokens.count(
      content.slice(range.startOffset, range.endOffset),
    );
  }
}

/** Keeps the trailing separator in the closing window so slices stay contiguous. */
function alignToWordEnd(
  content: string,
  startOffset: number,
  endOffset: number,
): number {
  if (endOffset >= content.length || /\s/.test(content[endOffset]!)) {
    return endOffset;
  }
  for (let offset = endOffset - 1; offset > startOffset; offset -= 1) {
    if (/\s/.test(content[offset]!)) {
      return offset + 1;
    }
  }
  return endOffset;
}

function alignToWordStart(
  content: string,
  startOffset: number,
  endOffset: number,
): number {
  if (startOffset === 0 || /\s/.test(content[startOffset - 1]!)) {
    return startOffset;
  }
  for (let offset = startOffset; offset < endOffset; offset += 1) {
    if (/\s/.test(content[offset]!)) {
      return offset + 1;
    }
  }
  return startOffset;
}
