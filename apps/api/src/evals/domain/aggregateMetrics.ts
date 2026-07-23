import {
  EvalMetricKeySchema,
  type EvalMetricKey,
  type MetricAggregate,
} from "@treasury-rag/contracts";

import type { EvalCaseResult } from "./evalReport.js";

export const EVAL_METRIC_KEYS = EvalMetricKeySchema.options;

/**
 * Aggregates per-case metric results. Only completed cases participate and
 * each metric's rate is passed / (passed + failed): notApplicable cases are
 * excluded from the denominator instead of being counted as failures.
 */
export function aggregateMetrics(
  cases: EvalCaseResult[],
): Record<EvalMetricKey, MetricAggregate> {
  const aggregates = Object.fromEntries(
    EVAL_METRIC_KEYS.map((metric) => [
      metric,
      { passed: 0, failed: 0, notApplicable: 0, rate: null },
    ]),
  ) as Record<EvalMetricKey, MetricAggregate>;

  for (const evalCase of cases) {
    if (evalCase.status !== "completed") {
      continue;
    }
    for (const metric of EVAL_METRIC_KEYS) {
      const result = evalCase.metrics[metric];
      if (!result) {
        continue;
      }
      aggregates[metric][result.status] += 1;
    }
  }

  for (const metric of EVAL_METRIC_KEYS) {
    const aggregate = aggregates[metric];
    const applicable = aggregate.passed + aggregate.failed;
    aggregate.rate = applicable === 0 ? null : aggregate.passed / applicable;
  }

  return aggregates;
}
