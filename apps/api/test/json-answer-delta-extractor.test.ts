import { describe, expect, it } from "vitest";

import { JsonAnswerDeltaExtractor } from "../src/grounding/infrastructure/json-answer-delta-extractor.js";

describe("JsonAnswerDeltaExtractor", () => {
  it("extracts only the answer field across arbitrary stream boundaries", () => {
    const extractor = new JsonAnswerDeltaExtractor();
    const fragments = [
      '{"ans',
      'wer":"Pago ',
      "parcial",
      ', factura abierta","claims":[]}',
    ];

    expect(fragments.map((fragment) => extractor.push(fragment)).join(""))
      .toBe("Pago parcial, factura abierta");
  });

  it("decodes JSON escapes and split Unicode surrogate pairs", () => {
    const extractor = new JsonAnswerDeltaExtractor();
    const fragments = [
      '{"answer":"Línea 1\\nLínea 2 ',
      "\\uD83D",
      '\\uDCB0","claims":[]}',
    ];

    expect(fragments.map((fragment) => extractor.push(fragment)).join(""))
      .toBe("Línea 1\nLínea 2 💰");
  });

  it("does not leak later structured fields as answer deltas", () => {
    const extractor = new JsonAnswerDeltaExtractor();

    expect(extractor.push(
      '{"answer":"Sí","claims":[{"text":"No emitir"}]}',
    )).toBe("Sí");
    expect(extractor.push("ignored")).toBe("");
  });
});
