import {
  GroundedAnswerRequestSchema,
  type EvalMetricKey,
  type GroundedAnswerResponse,
  type SearchConfig,
  type SearchResult,
} from "@treasury-rag/contracts";

import type { GroundedAnswerGenerator } from "../../grounding/ports/GroundedAnswerGenerator.js";
import type { PolicySearch } from "../../retrieval/ports/PolicySearch.js";
import { evaluateGrounding } from "../../runs/domain/evaluateGrounding.js";
import {
  abstentionMetric,
  exactValuesMetric,
  notApplicableMetric,
} from "../domain/answerChecks.js";
import { aggregateMetrics } from "../domain/aggregateMetrics.js";
import type { EvalCase } from "../domain/evalCase.js";
import {
  EvalReportSchema,
  type EvalCaseResult,
  type EvalFailure,
  type EvalGrading,
  type EvalReport,
  type MetricResult,
} from "../domain/evalReport.js";
import { latestVersionMetric } from "../domain/latestVersionCheck.js";
import { retrievalRecallMetric } from "../domain/retrievalRecall.js";
import type { EvalGrader } from "../ports/EvalGrader.js";

/**
 * Contextual ingestion is on by default because it is the system's default
 * behaviour after slice 8. The pre-slice-8 pipeline stays reachable and
 * reproducible by setting `contextualIngestion` to false, which is exactly
 * what the Failure Lab experiment does.
 */
export const DEFAULT_EVAL_CONFIG: SearchConfig = {
  chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
  topK: 5,
  threshold: 0.7,
  tenantFilterEnabled: true,
  latestVersionOnly: true,
  contextualIngestion: true,
};

export type EvalRunMode = "retrieval" | "grounded";

export type EvalRunOptions = {
  mode: EvalRunMode;
  config?: SearchConfig | undefined;
  datasetVersion?: string;
  answerExecutor?: { provider: string; model: string } | undefined;
  now?: (() => Date) | undefined;
};

/**
 * Executes an eval dataset through the existing retrieval and grounding
 * ports. Retrieval evaluation, grounded-answer evaluation and optional model
 * grading stay separate stages: a case can measure recall without paying for
 * generation, and a failing case never aborts the suite.
 */
export class EvalRunner {
  constructor(
    private readonly search: PolicySearch,
    private readonly answers?: GroundedAnswerGenerator | undefined,
    private readonly grader?: EvalGrader | undefined,
  ) {}

  async run(
    dataset: EvalCase[],
    options: EvalRunOptions,
  ): Promise<EvalReport> {
    const now = options.now ?? (() => new Date());
    const results: EvalCaseResult[] = [];

    for (const evalCase of dataset) {
      results.push(await this.runCase(evalCase, options));
    }

    const completedCases = results.filter(
      (result) => result.status === "completed",
    );

    return EvalReportSchema.parse({
      generatedAt: now().toISOString(),
      mode: options.mode,
      configuration: {
        datasetVersion: options.datasetVersion ?? "unknown",
        defaultConfig: options.config ?? DEFAULT_EVAL_CONFIG,
        answerExecutor: options.mode === "grounded" && options.answerExecutor
          ? options.answerExecutor
          : null,
        grader: this.grader
          ? { provider: this.grader.id, model: this.grader.model }
          : null,
      },
      summary: {
        totalCases: dataset.length,
        completedCases: completedCases.length,
        erroredCases: results.length - completedCases.length,
        metrics: aggregateMetrics(results),
      },
      cases: results,
      failures: this.collectFailures(results),
    });
  }

  private async runCase(
    evalCase: EvalCase,
    options: EvalRunOptions,
  ): Promise<EvalCaseResult> {
    const startedAt = performance.now();
    try {
      const config = resolveCaseConfig(evalCase, options.config);
      const searchResponse = await this.search.search({
        query: evalCase.query,
        tenant: evalCase.tenant,
        config,
      });
      const sources = searchResponse.results;
      const response = options.mode === "grounded" && this.answers
        ? await this.answer(evalCase, config)
        : undefined;
      const grading = await this.grade(evalCase, response);

      return {
        caseId: evalCase.id,
        name: evalCase.name,
        status: "completed",
        error: null,
        metrics: this.evaluateCase(evalCase, sources, response, config),
        grading,
        retrievedChunkIds: sources.map((source) => source.chunkId),
        durationMs: performance.now() - startedAt,
      };
    } catch (error) {
      return {
        caseId: evalCase.id,
        name: evalCase.name,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown eval error",
        metrics: {},
        grading: null,
        retrievedChunkIds: [],
        durationMs: performance.now() - startedAt,
      };
    }
  }

  private evaluateCase(
    evalCase: EvalCase,
    sources: SearchResult[],
    response: GroundedAnswerResponse | undefined,
    config: SearchConfig,
  ): Partial<Record<EvalMetricKey, MetricResult>> {
    const leakage = evaluateGrounding({
      claims: [],
      sources,
      tenant: evalCase.tenant,
      allowedTenants: evalCase.allowedTenants,
    });
    const citations = response && response.claims.length > 0
      ? evaluateGrounding({
          claims: response.claims,
          sources: response.sources,
          tenant: evalCase.tenant,
          allowedTenants: evalCase.allowedTenants,
        })
      : undefined;

    return {
      retrievalRecallAtK: retrievalRecallMetric(
        evalCase.expectedEvidence,
        sources,
        config.topK,
      ),
      citationValidity: citations
        ? booleanMetric(
            citations.citationValidity,
            "Todas las citas existen en el contexto recuperado",
            `Citas inexistentes: ${citations.invalidCitationIds.join(", ")}`,
          )
        : notApplicableMetric(
            response
              ? "La respuesta no hizo afirmaciones citadas"
              : "No se ejecutó una respuesta grounded",
          ),
      tenantLeakage: booleanMetric(
        !leakage.tenantLeakage,
        "Ninguna fuente pertenece a un tenant no permitido",
        `Fuentes de tenants no permitidos: ${
          leakage.leakedSources
            .map((source) => `${source.documentId} (${source.tenant})`)
            .join(", ")
        }`,
      ),
      latestVersionSelection: latestVersionMetric(
        evalCase.expectedVersion,
        sources,
      ),
      exactValues: exactValuesMetric(evalCase, response),
      abstentionAccuracy: abstentionMetric(evalCase, response),
    };
  }

  private async answer(
    evalCase: EvalCase,
    config: SearchConfig,
  ): Promise<GroundedAnswerResponse> {
    const request = GroundedAnswerRequestSchema.parse({
      query: evalCase.query,
      tenant: evalCase.tenant,
      config,
    });
    return this.answers!.answer(request);
  }

  private async grade(
    evalCase: EvalCase,
    response: GroundedAnswerResponse | undefined,
  ): Promise<EvalGrading | null> {
    if (!this.grader || !response) {
      return null;
    }
    try {
      return await this.grader.grade({ evalCase, response });
    } catch (error) {
      const reason = error instanceof Error
        ? error.message
        : "Unknown grader error";
      return {
        faithfulness: { status: "unavailable", reason },
        relevance: { status: "unavailable", reason },
        correctness: { status: "unavailable", reason },
      };
    }
  }

  private collectFailures(results: EvalCaseResult[]): EvalFailure[] {
    return results.flatMap((result): EvalFailure[] => {
      if (result.status === "error") {
        return [{
          caseId: result.caseId,
          name: result.name,
          kind: "error" as const,
          detail: result.error ?? "Unknown eval error",
        }];
      }
      const failedMetrics = Object.entries(result.metrics)
        .filter(([, metric]) => metric?.status === "failed")
        .map(([metric]) => metric);
      return failedMetrics.length > 0
        ? [{
            caseId: result.caseId,
            name: result.name,
            kind: "failed" as const,
            detail: `Métricas fallidas: ${failedMetrics.join(", ")}`,
          }]
        : [];
    });
  }
}

function resolveCaseConfig(
  evalCase: EvalCase,
  runConfig: SearchConfig | undefined,
): SearchConfig {
  if (runConfig) {
    return runConfig;
  }
  const overrides = evalCase.config;
  return {
    chunking: overrides?.chunking ?? DEFAULT_EVAL_CONFIG.chunking,
    topK: overrides?.topK ?? DEFAULT_EVAL_CONFIG.topK,
    threshold: overrides?.threshold ?? DEFAULT_EVAL_CONFIG.threshold,
    tenantFilterEnabled: overrides?.tenantFilterEnabled
      ?? DEFAULT_EVAL_CONFIG.tenantFilterEnabled,
    latestVersionOnly: overrides?.latestVersionOnly
      ?? DEFAULT_EVAL_CONFIG.latestVersionOnly,
    contextualIngestion: overrides?.contextualIngestion
      ?? DEFAULT_EVAL_CONFIG.contextualIngestion,
  };
}

function booleanMetric(
  ok: boolean,
  passedDetail: string,
  failedDetail: string,
): MetricResult {
  return ok
    ? { status: "passed", detail: passedDetail, value: 1 }
    : { status: "failed", detail: failedDetail, value: 0 };
}
