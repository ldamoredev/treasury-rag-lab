export type SourceRange = {
  startOffset: number;
  endOffset: number;
};

export type MarkdownHeading = {
  level: number;
  text: string;
  offset: number;
};

const HEADING_PATTERN = /^(#{1,6})[\t ]+(.+?)[\t ]*$/gm;

/**
 * Markdown structure is read with a scanner over the raw source instead of a
 * full AST. The corpus is ATX-only, and every consumer needs exact character
 * offsets into the original document: a chunk must stay a literal slice of
 * its source so citations can never drift from what the document says.
 */
export function findHeadings(content: string): MarkdownHeading[] {
  return Array.from(content.matchAll(HEADING_PATTERN), (match) => ({
    level: match[1]!.length,
    text: match[2]!,
    offset: match.index,
  }));
}

export function findSectionRanges(content: string): SourceRange[] {
  if (content.length === 0) {
    return [];
  }

  const headingOffsets = findHeadings(content).map((heading) => heading.offset);
  const starts = headingOffsets[0] === 0
    ? headingOffsets
    : [0, ...headingOffsets];

  return starts.map((startOffset, index) => ({
    startOffset,
    endOffset: starts[index + 1] ?? content.length,
  }));
}

/**
 * The chain of enclosing headings for a source offset, outermost first. This
 * is the context a chunk silently loses when it is cut below the heading that
 * gave it meaning.
 */
export function headingPathAt(content: string, offset: number): string[] {
  const path: MarkdownHeading[] = [];

  for (const heading of findHeadings(content)) {
    if (heading.offset > offset) {
      break;
    }
    while (path.length > 0 && path[path.length - 1]!.level >= heading.level) {
      path.pop();
    }
    path.push(heading);
  }

  return path.map((heading) => heading.text);
}
