import { describe, expect, it } from "vitest";

import { cosineSimilarity } from "../src/retrieval/domain/cosine-similarity.js";

describe("cosineSimilarity", () => {
  it("returns one for identical vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2])).toBeCloseTo(1);
  });

  it("returns zero for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns minus one for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("rejects vectors with different dimensions", () => {
    expect(() => cosineSimilarity([1], [1, 2])).toThrow(/same dimensions/);
  });

  it("rejects zero vectors", () => {
    expect(() => cosineSimilarity([0, 0], [1, 0])).toThrow(/zero vectors/);
  });

  it("rejects non-finite values", () => {
    expect(() => cosineSimilarity([Number.NaN], [1])).toThrow(/finite/);
  });
});
