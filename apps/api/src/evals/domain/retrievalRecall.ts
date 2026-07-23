import type { SearchResult } from "@treasury-rag/contracts";

import type { ExpectedEvidence } from "./evalCase.js";
import type { MetricResult } from "./evalReport.js";

export type RetrievalRecall = {
  recall: number;
  found: number;
  total: number;
  missing: ExpectedEvidence[];
};

/**
 * recall@k = expected evidence fragments found inside the top-k retrieved
 * chunks / expected evidence fragments. Expectations are semantically stable:
 * a fragment counts as found when any retrieved chunk from the expected
 * document contains the required text, regardless of the chunk ID the
 * current chunking produced.
 */
export function computeRetrievalRecall(
  expectedEvidence: ExpectedEvidence[],
  sources: SearchResult[],
): RetrievalRecall {
  const missing = expectedEvidence.filter(
    (expectation) =>
      !sources.some(
        (source) =>
          source.documentId === expectation.documentId
          && source.text.includes(expectation.fragment),
      ),
  );
  const total = expectedEvidence.length;
  const found = total - missing.length;

  return { recall: total === 0 ? 0 : found / total, found, total, missing };
}

export function retrievalRecallMetric(
  expectedEvidence: ExpectedEvidence[],
  sources: SearchResult[],
  topK: number,
): MetricResult {
  if (expectedEvidence.length === 0) {
    return {
      status: "notApplicable",
      detail: "El caso no espera evidencia de retrieval",
      value: null,
    };
  }

  const result = computeRetrievalRecall(expectedEvidence, sources);
  const detail = result.missing.length === 0
    ? `${result.found}/${result.total} fragmentos esperados dentro del top-${topK}`
    : `${result.found}/${result.total} fragmentos; faltan: ${
      result.missing.map((missing) =>
        `${missing.documentId} (“${missing.fragment.slice(0, 40)}…”)`
      ).join(", ")
    }`;

  return {
    status: result.missing.length === 0 ? "passed" : "failed",
    detail,
    value: result.recall,
  };
}
