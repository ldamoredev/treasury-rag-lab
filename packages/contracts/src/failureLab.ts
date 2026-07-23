import { z } from "zod";

import { CharacterChunkingConfigSchema } from "./chunking.js";

export const ExperimentVariableSchema = z.enum([
  "chunkingStrategy",
  "chunkSize",
  "overlap",
  "topK",
  "threshold",
  "tenantFilter",
  "latestVersionFilter",
]);

export const ResponsibleLayerSchema = z.enum([
  "chunking",
  "retrieval",
  "filtering",
  "generation",
  "evaluation",
]);

export const EvalMetricKeySchema = z.enum([
  "retrievalRecallAtK",
  "citationValidity",
  "tenantLeakage",
  "latestVersionSelection",
  "exactValues",
  "abstentionAccuracy",
]);

export const EvalMetricStatusSchema = z.enum([
  "passed",
  "failed",
  "notApplicable",
]);

export const FailureLabConfigSchema = z.object({
  chunking: CharacterChunkingConfigSchema,
  topK: z.number().int().min(1).max(20),
  threshold: z.number().min(-1).max(1),
  tenantFilterEnabled: z.boolean(),
  latestVersionOnly: z.boolean(),
});

export const FailureLabExperimentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  variable: ExperimentVariableSchema,
  baseline: FailureLabConfigSchema,
  variant: FailureLabConfigSchema,
  responsibleLayer: ResponsibleLayerSchema,
  suggestedFix: z.string().min(1),
  learning: z.string().min(1),
});

export const FailureLabExperimentListResponseSchema = z.object({
  experiments: z.array(FailureLabExperimentSchema),
});

export const FailureLabComparisonRequestSchema = z.object({
  experimentId: z.string().min(1),
});

export const MetricAggregateSchema = z.object({
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1).nullable(),
});

export const FailureLabMetricDeltaSchema = z.object({
  metric: EvalMetricKeySchema,
  label: z.string().min(1),
  baseline: MetricAggregateSchema,
  variant: MetricAggregateSchema,
  delta: z.number().min(-1).max(1).nullable(),
});

export const FailureLabCaseChangeSchema = z.object({
  caseId: z.string().min(1),
  name: z.string().min(1),
  baselineStatus: EvalMetricStatusSchema,
  variantStatus: EvalMetricStatusSchema,
  detail: z.string(),
});

export const FailureLabComparisonResponseSchema = z.object({
  experiment: FailureLabExperimentSchema,
  mode: z.literal("retrieval"),
  generatedAt: z.string().datetime(),
  metricDeltas: z.array(FailureLabMetricDeltaSchema),
  improvedCases: z.array(FailureLabCaseChangeSchema),
  degradedCases: z.array(FailureLabCaseChangeSchema),
  unchangedCases: z.number().int().nonnegative(),
  observedFailure: z.string(),
  responsibleLayer: ResponsibleLayerSchema,
  suggestedFix: z.string().min(1),
});

export type ExperimentVariable = z.infer<typeof ExperimentVariableSchema>;
export type ResponsibleLayer = z.infer<typeof ResponsibleLayerSchema>;
export type EvalMetricKey = z.infer<typeof EvalMetricKeySchema>;
export type EvalMetricStatus = z.infer<typeof EvalMetricStatusSchema>;
export type FailureLabConfig = z.infer<typeof FailureLabConfigSchema>;
export type FailureLabExperiment = z.infer<typeof FailureLabExperimentSchema>;
export type FailureLabExperimentListResponse = z.infer<
  typeof FailureLabExperimentListResponseSchema
>;
export type FailureLabComparisonRequest = z.infer<
  typeof FailureLabComparisonRequestSchema
>;
export type MetricAggregate = z.infer<typeof MetricAggregateSchema>;
export type FailureLabMetricDelta = z.infer<typeof FailureLabMetricDeltaSchema>;
export type FailureLabCaseChange = z.infer<typeof FailureLabCaseChangeSchema>;
export type FailureLabComparisonResponse = z.infer<
  typeof FailureLabComparisonResponseSchema
>;
