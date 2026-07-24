import { describe, expect, it } from "vitest";

import {
  findSectionRanges,
  headingPathAt,
} from "../src/ingestion/domain/markdownStructure.js";

describe("findSectionRanges", () => {
  it("returns one section per ATX heading with exact source offsets", () => {
    const content = "# A\nalpha\n## B\nbeta";

    const ranges = findSectionRanges(content);

    expect(ranges).toEqual([
      { startOffset: 0, endOffset: 10 },
      { startOffset: 10, endOffset: 19 },
    ]);
    expect(
      ranges
        .map((range) => content.slice(range.startOffset, range.endOffset))
        .join(""),
    ).toBe(content);
  });

  it("keeps a preamble before the first heading as its own section", () => {
    const content = "Intro\n\n# A\nalpha";

    expect(findSectionRanges(content)[0]).toEqual({
      startOffset: 0,
      endOffset: 7,
    });
  });

  it("returns a single section when the document has no headings", () => {
    const content = "Just a paragraph.";

    expect(findSectionRanges(content)).toEqual([
      { startOffset: 0, endOffset: content.length },
    ]);
  });

  it("returns no sections for empty content", () => {
    expect(findSectionRanges("")).toEqual([]);
  });
});

describe("headingPathAt", () => {
  const content = [
    "# Política",
    "Intro",
    "## Escalamiento",
    "Regla",
    "### Excepciones",
    "Detalle",
    "## Registro",
    "Cierre",
  ].join("\n");

  it("builds the heading path for an offset inside a nested section", () => {
    const offset = content.indexOf("Detalle");

    expect(headingPathAt(content, offset)).toEqual([
      "Política",
      "Escalamiento",
      "Excepciones",
    ]);
  });

  it("drops deeper headings when a shallower one follows", () => {
    const offset = content.indexOf("Cierre");

    expect(headingPathAt(content, offset)).toEqual(["Política", "Registro"]);
  });

  it("returns an empty heading path for content before any heading", () => {
    expect(headingPathAt("Preamble\n# A\nalpha", 0)).toEqual([]);
  });

  it("includes the heading itself when the offset is on the heading line", () => {
    const offset = content.indexOf("## Registro");

    expect(headingPathAt(content, offset)).toEqual(["Política", "Registro"]);
  });
});
