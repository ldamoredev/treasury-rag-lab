import {
  EvalMetricKeySchema,
  FailureLabComparisonResponseSchema,
  type EvalMetricKey,
  type EvalMetricStatus,
  type FailureLabCaseChange,
  type FailureLabComparisonResponse,
  type FailureLabConfig,
  type FailureLabExperiment,
  type SearchConfig,
} from "@treasury-rag/contracts";

import type { EvalRunner } from "../../evals/application/EvalRunner.js";
import type { EvalCase } from "../../evals/domain/evalCase.js";
import type { EvalCaseResult } from "../../evals/domain/evalReport.js";
import { compareExperimentConfigs } from "../domain/compareExperimentConfigs.js";
import { findFailureLabExperiment } from "../domain/failureLabExperiments.js";
import { ExperimentNotFoundError } from "./ExperimentNotFoundError.js";

const METRIC_LABELS: Record<EvalMetricKey, string> = {
  retrievalRecallAtK: "Recall de retrieval@k",
  citationValidity: "Validez de citas",
  tenantLeakage: "Fuga entre tenants",
  latestVersionSelection: "Selección de versión vigente",
  exactValues: "Exactitud de montos y fechas",
  abstentionAccuracy: "Precisión de abstención",
};

/**
 * Compares one predefined experiment by running the eval dataset twice
 * (baseline vs variant) in retrieval-only mode: local embeddings, no chat
 * provider, no paid calls.
 */
export class RunFailureLabComparison {
  constructor(
    private readonly runner: EvalRunner,
    private readonly dataset: EvalCase[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(experimentId: string): Promise<FailureLabComparisonResponse> {
    const experiment = findFailureLabExperiment(experimentId);
    if (!experiment) {
      throw new ExperimentNotFoundError(experimentId);
    }
    compareExperimentConfigs(experiment.baseline, experiment.variant);

    const baselineReport = await this.runner.run(this.dataset, {
      mode: "retrieval",
      config: toSearchConfig(experiment.baseline),
      now: this.now,
    });
    const variantReport = await this.runner.run(this.dataset, {
      mode: "retrieval",
      config: toSearchConfig(experiment.variant),
      now: this.now,
    });

    if (
      baselineReport.summary.erroredCases === baselineReport.summary.totalCases
      || variantReport.summary.erroredCases === variantReport.summary.totalCases
    ) {
      throw new Error(
        "The failure lab comparison failed for every eval case",
      );
    }

    const { improved, degraded, unchanged } = collectCaseChanges(
      baselineReport.cases,
      variantReport.cases,
    );

    return FailureLabComparisonResponseSchema.parse({
      experiment,
      mode: "retrieval",
      generatedAt: this.now().toISOString(),
      metricDeltas: EvalMetricKeySchema.options.map((metric) => {
        const baseline = baselineReport.summary.metrics[metric];
        const variant = variantReport.summary.metrics[metric];
        return {
          metric,
          label: METRIC_LABELS[metric],
          baseline,
          variant,
          delta: baseline?.rate != null && variant?.rate != null
            ? variant.rate - baseline.rate
            : null,
        };
      }),
      improvedCases: improved,
      degradedCases: degraded,
      unchangedCases: unchanged,
      observedFailure: describeObservedFailure(
        experiment,
        improved,
        degraded,
      ),
      responsibleLayer: experiment.responsibleLayer,
      suggestedFix: experiment.suggestedFix,
    });
  }
}

function toSearchConfig(config: FailureLabConfig): SearchConfig {
  return {
    chunking: config.chunking,
    topK: config.topK,
    threshold: config.threshold,
    tenantFilterEnabled: config.tenantFilterEnabled,
    latestVersionOnly: config.latestVersionOnly,
  };
}

function caseOutcome(result: EvalCaseResult | undefined): EvalMetricStatus {
  if (!result || result.status === "error") {
    return "failed";
  }
  const statuses = Object.values(result.metrics).map(
    (metric) => metric.status,
  );
  if (statuses.includes("failed")) {
    return "failed";
  }
  return statuses.includes("passed") ? "passed" : "notApplicable";
}

function changedMetricDetails(
  baseline: EvalCaseResult | undefined,
  variant: EvalCaseResult | undefined,
): string {
  return EvalMetricKeySchema.options
    .filter((metric) =>
      baseline?.metrics[metric]?.status !== variant?.metrics[metric]?.status
    )
    .map((metric) =>
      `${metric}: ${baseline?.metrics[metric]?.status ?? "error"} → ${variant?.metrics[metric]?.status ?? "error"}`
    )
    .join("; ");
}

function collectCaseChanges(
  baselineCases: EvalCaseResult[],
  variantCases: EvalCaseResult[],
): { improved: FailureLabCaseChange[]; degraded: FailureLabCaseChange[]; unchanged: number } {
  const variantByCase = new Map(
    variantCases.map((result) => [result.caseId, result]),
  );
  const improved: FailureLabCaseChange[] = [];
  const degraded: FailureLabCaseChange[] = [];
  let unchanged = 0;

  for (const baselineCase of baselineCases) {
    const variantCase = variantByCase.get(baselineCase.caseId);
    const baselineStatus = caseOutcome(baselineCase);
    const variantStatus = caseOutcome(variantCase);

    if (baselineStatus === variantStatus) {
      unchanged += 1;
      continue;
    }

    const change = {
      caseId: baselineCase.caseId,
      name: baselineCase.name,
      baselineStatus,
      variantStatus,
      detail: changedMetricDetails(baselineCase, variantCase),
    };
    if (variantStatus === "failed") {
      degraded.push(change);
    } else if (baselineStatus === "failed") {
      improved.push(change);
    } else {
      unchanged += 1;
    }
  }

  return { improved, degraded, unchanged };
}

export function describeObservedFailure(
  experiment: FailureLabExperiment,
  improved: FailureLabCaseChange[],
  degraded: FailureLabCaseChange[],
): string {
  if (degraded.length > 0) {
    const first = degraded[0]!;
    return `La variante degradó ${degraded.length} caso(s): ${
      degraded.map((change) => change.caseId).join(", ")
    }. Ejemplo: “${first.name}” pasó de ${first.baselineStatus} a ${first.variantStatus} (${first.detail}).`;
  }
  if (improved.length > 0) {
    const first = improved[0]!;
    return `El baseline falló en ${improved.length} caso(s) que la variante recuperó: ${
      improved.map((change) => change.caseId).join(", ")
    }. Ejemplo: “${first.name}” pasó de ${first.baselineStatus} a ${first.variantStatus} (${first.detail}).`;
  }
  return `El dataset actual no mostró diferencias observables al cambiar ${experiment.variable}; este experimento necesita más casos discriminantes antes de sacar conclusiones.`;
}
