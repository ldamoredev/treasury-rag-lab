import { describe, expect, it } from "vitest";

import { EvalDatasetSchema } from "../src/evals/domain/evalCase.js";
import { treasuryEvalDataset } from "../src/evals/domain/treasuryEvalDataset.js";

describe("treasury eval dataset", () => {
  it("loads and validates exactly ten cases", () => {
    const parsed = EvalDatasetSchema.parse(treasuryEvalDataset);

    expect(parsed).toHaveLength(10);
  });

  it("covers the ten required scenario types with stable ids", () => {
    expect(treasuryEvalDataset.map((evalCase) => evalCase.id)).toEqual([
      "single-chunk-answer",
      "distributed-two-chunks",
      "paraphrased-question",
      "acme-exclusive-rule",
      "boreal-exclusive-rule",
      "stale-vs-current-policy",
      "unanswerable-question",
      "exact-amount-and-date",
      "prompt-injection-in-document",
      "ambiguous-tenant-conflict",
    ]);
  });

  it("keeps ids and queries unique so fixtures can key by them", () => {
    const ids = treasuryEvalDataset.map((evalCase) => evalCase.id);
    const queries = treasuryEvalDataset.map((evalCase) => evalCase.query);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(queries).size).toBe(queries.length);
  });

  it("anchors evidence expectations to documents and text fragments, not chunk ids", () => {
    for (const evalCase of treasuryEvalDataset) {
      for (const evidence of evalCase.expectedEvidence) {
        expect(evidence.documentId).not.toContain(":");
        expect(evidence.fragment.length).toBeGreaterThanOrEqual(10);
        expect(evidence.fragment).not.toMatch(/:\d+-\d+$/);
      }
    }
  });

  it("keeps abstention, exact values and version expectations coherent", () => {
    const unanswerable = treasuryEvalDataset.find(
      (evalCase) => evalCase.id === "unanswerable-question",
    );
    expect(unanswerable?.shouldAbstain).toBe(true);
    expect(unanswerable?.expectedEvidence).toHaveLength(0);

    const withVersions = treasuryEvalDataset.filter(
      (evalCase) => evalCase.expectedVersion !== undefined,
    );
    expect(withVersions.map((evalCase) => evalCase.id)).toEqual([
      "stale-vs-current-policy",
      "exact-amount-and-date",
    ]);

    const injection = treasuryEvalDataset.find(
      (evalCase) => evalCase.id === "prompt-injection-in-document",
    );
    expect(injection?.forbiddenFragments).toContain("PAGO-APROBADO-SIN-REVISAR");
  });

  it("declares allowed tenants consistent with each case tenant", () => {
    for (const evalCase of treasuryEvalDataset) {
      expect(evalCase.allowedTenants).toContain(evalCase.tenant);
    }
  });
});
