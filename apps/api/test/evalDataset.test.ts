import { describe, expect, it } from "vitest";

import { FileDocumentRepository } from "../src/documents/infrastructure/FileDocumentRepository.js";
import { EvalDatasetSchema } from "../src/evals/domain/evalCase.js";
import { treasuryEvalDataset } from "../src/evals/domain/treasuryEvalDataset.js";

describe("treasury eval dataset", () => {
  it("loads and validates exactly thirteen cases", () => {
    const parsed = EvalDatasetSchema.parse(treasuryEvalDataset);

    expect(parsed).toHaveLength(13);
  });

  it("covers the required scenario types with stable ids", () => {
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
      "ambiguous-tolerance-fragment",
      "ambiguous-deadline-fragment",
      "ambiguous-extra-approval-fragment",
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

  it("anchors every expected fragment to text that exists in the corpus", () => {
    const documents = new FileDocumentRepository();

    for (const evalCase of treasuryEvalDataset) {
      for (const evidence of evalCase.expectedEvidence) {
        const document = documents.findById(evidence.documentId);
        expect(document, `unknown document ${evidence.documentId}`).toBeDefined();
        expect(
          document!.content.includes(evidence.fragment),
          `${evalCase.id}: “${evidence.fragment}” is not in ${evidence.documentId}`,
        ).toBe(true);
      }
    }
  });

  it("keeps the ambiguous fragments free of the terms their question uses", () => {
    // The point of these cases: the sentence answers the question without
    // sharing its vocabulary. If a fragment started naming the tenant or the
    // topic, the case would stop measuring contextual ingestion.
    const ambiguous = treasuryEvalDataset.filter((evalCase) =>
      evalCase.tags.includes("ambiguous-chunk")
    );
    expect(ambiguous).toHaveLength(3);

    for (const evalCase of ambiguous) {
      for (const evidence of evalCase.expectedEvidence) {
        expect(evidence.fragment.toLowerCase()).not.toContain(evalCase.tenant);
      }
    }
  });
});
