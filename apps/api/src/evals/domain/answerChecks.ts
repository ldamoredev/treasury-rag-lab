import type { GroundedAnswerResponse } from "@treasury-rag/contracts";

import type { EvalCase } from "./evalCase.js";
import type { MetricResult } from "./evalReport.js";

export function notApplicableMetric(reason: string): MetricResult {
  return { status: "notApplicable", detail: reason, value: null };
}

/**
 * Exact-value accuracy: every expected amount/date must appear verbatim in
 * the answer text and no forbidden fragment (for example a prompt-injection
 * canary) may appear. A case that should have been answered but abstained
 * fails, because none of the expected values can be present.
 */
export function exactValuesMetric(
  evalCase: EvalCase,
  response: GroundedAnswerResponse | undefined,
): MetricResult {
  const expectations = evalCase.expectedExactValues;
  const forbidden = evalCase.forbiddenFragments;
  if (expectations.length === 0 && forbidden.length === 0) {
    return notApplicableMetric("El caso no fija valores exactos ni fragmentos prohibidos");
  }
  if (!response) {
    return notApplicableMetric("No se ejecutó una respuesta grounded");
  }
  if (evalCase.shouldAbstain) {
    return notApplicableMetric("El caso debe abstenerse; no se exigen valores exactos");
  }

  const missing = expectations.filter(
    (value) => !response.answer.includes(value),
  );
  const leaked = forbidden.filter((fragment) =>
    response.answer.includes(fragment)
  );

  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(`valores ausentes: ${missing.join(", ")}`);
  }
  if (leaked.length > 0) {
    problems.push(`fragmentos prohibidos presentes: ${leaked.join(", ")}`);
  }

  return problems.length === 0
    ? {
        status: "passed",
        detail: `${expectations.length} valores exactos presentes y ningún fragmento prohibido`,
        value: 1,
      }
    : { status: "failed", detail: problems.join("; "), value: 0 };
}

/**
 * Abstention accuracy: the answer's insufficientEvidence flag must match the
 * case's shouldAbstain expectation. Denominator: cases with an executed
 * grounded answer.
 */
export function abstentionMetric(
  evalCase: EvalCase,
  response: GroundedAnswerResponse | undefined,
): MetricResult {
  if (!response) {
    return notApplicableMetric("No se ejecutó una respuesta grounded");
  }

  const abstained = response.insufficientEvidence;
  if (abstained === evalCase.shouldAbstain) {
    return {
      status: "passed",
      detail: evalCase.shouldAbstain
        ? "Se abstuvo correctamente ante una pregunta sin respuesta"
        : "Respondió una pregunta que tenía evidencia suficiente",
      value: 1,
    };
  }

  return {
    status: "failed",
    detail: evalCase.shouldAbstain
      ? "Debía abstenerse y respondió con afirmaciones"
      : "Tenía evidencia suficiente y se abstuvo",
    value: 0,
  };
}
