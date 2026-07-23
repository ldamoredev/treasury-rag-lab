import type { SearchResult } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import {
  computeRetrievalRecall,
  retrievalRecallMetric,
} from "../src/evals/domain/retrievalRecall.js";

function source(overrides: Partial<SearchResult>): SearchResult {
  return {
    rank: 1,
    chunkId: "doc:characters:0:0-10",
    documentId: "doc",
    documentTitle: "Documento",
    tenant: "global",
    version: 1,
    effectiveFrom: "2026-01-01",
    score: 0.9,
    text: "texto",
    startOffset: 0,
    endOffset: 10,
    ...overrides,
  };
}

describe("retrieval recall", () => {
  it("reports full recall when every expected fragment is retrieved", () => {
    const result = computeRetrievalRecall(
      [
        { documentId: "policy", fragment: "permanece abierta" },
        { documentId: "policy", fragment: "saldo pendiente" },
      ],
      [
        source({
          documentId: "policy",
          text: "La factura permanece abierta por el saldo pendiente.",
        }),
      ],
    );

    expect(result).toEqual({
      recall: 1,
      found: 2,
      total: 2,
      missing: [],
    });
  });

  it("reports partial recall when only some fragments are retrieved", () => {
    const result = computeRetrievalRecall(
      [
        { documentId: "policy", fragment: "permanece abierta" },
        { documentId: "acme", fragment: "aprobación humana" },
      ],
      [
        source({
          documentId: "policy",
          text: "La factura permanece abierta por el saldo pendiente.",
        }),
      ],
    );

    expect(result.recall).toBe(0.5);
    expect(result.found).toBe(1);
    expect(result.missing).toEqual([
      { documentId: "acme", fragment: "aprobación humana" },
    ]);
  });

  it("does not count a fragment found in a different document", () => {
    const result = computeRetrievalRecall(
      [{ documentId: "policy", fragment: "aprobación humana" }],
      [source({ documentId: "other", text: "aprobación humana siempre" })],
    );

    expect(result.recall).toBe(0);
  });

  it("marks the metric notApplicable when the case expects no evidence", () => {
    const metric = retrievalRecallMetric([], [], 5);

    expect(metric.status).toBe("notApplicable");
    expect(metric.value).toBeNull();
  });

  it("fails the metric on partial recall and passes it on full recall", () => {
    const sources = [
      source({
        documentId: "policy",
        text: "La factura permanece abierta por el saldo pendiente.",
      }),
    ];

    const partial = retrievalRecallMetric(
      [
        { documentId: "policy", fragment: "permanece abierta" },
        { documentId: "policy", fragment: "fragmento inexistente" },
      ],
      sources,
      5,
    );
    const full = retrievalRecallMetric(
      [{ documentId: "policy", fragment: "permanece abierta" }],
      sources,
      5,
    );

    expect(partial.status).toBe("failed");
    expect(partial.value).toBe(0.5);
    expect(full.status).toBe("passed");
    expect(full.value).toBe(1);
  });
});
