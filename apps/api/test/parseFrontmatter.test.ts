import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "../src/ingestion/domain/parseFrontmatter.js";

describe("parseFrontmatter", () => {
  it("reads scalar fields from a leading frontmatter block", () => {
    const source = [
      "---",
      "id: partial-payments",
      "title: Política global de pagos parciales",
      "tenant: global",
      "version: 2",
      "effectiveFrom: 2026-01-15",
      "---",
      "# Política global de pagos parciales",
    ].join("\n");

    expect(parseFrontmatter(source).metadata).toEqual({
      id: "partial-payments",
      title: "Política global de pagos parciales",
      tenant: "global",
      version: "2",
      effectiveFrom: "2026-01-15",
    });
  });

  it("returns the body without the frontmatter so source offsets start at the body", () => {
    const body = "# Title\n\nFirst rule.";
    const source = `---\nid: a\n---\n${body}`;

    const parsed = parseFrontmatter(source);

    expect(parsed.body).toBe(body);
    expect(parsed.body.startsWith("# Title")).toBe(true);
  });

  it("treats a document without frontmatter as an empty metadata block", () => {
    const source = "# Title\n\nBody without metadata.";

    expect(parseFrontmatter(source)).toEqual({
      metadata: {},
      body: source,
    });
  });

  it("ignores a --- separator that is not at the start of the document", () => {
    const source = "# Title\n\n---\n\nA thematic break, not frontmatter.";

    expect(parseFrontmatter(source).metadata).toEqual({});
    expect(parseFrontmatter(source).body).toBe(source);
  });

  it("rejects an unterminated frontmatter block", () => {
    const source = "---\nid: a\ntitle: Never closed\n\n# Title";

    expect(() => parseFrontmatter(source)).toThrow(
      /frontmatter block is not terminated/i,
    );
  });

  it("strips surrounding quotes from a value", () => {
    const source = `---\ntitle: "Quoted: with colon"\n---\nBody`;

    expect(parseFrontmatter(source).metadata.title).toBe("Quoted: with colon");
  });

  it("rejects a frontmatter line that is not a key/value pair", () => {
    const source = "---\nid: a\nnot a pair\n---\nBody";

    expect(() => parseFrontmatter(source)).toThrow(/not a key\/value pair/i);
  });
});
