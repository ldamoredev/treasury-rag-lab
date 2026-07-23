import { z } from "zod";

import {
  EvalMetricKeySchema,
  EvalMetricStatusSchema,
  MetricAggregateSchema,
  SearchConfigSchema,
} from "@treasury-rag/contracts";

export const MetricResultSchema = z.object({
  status: EvalMetricStatusSchema,
  detail: z.string(),
  value: z.number().nullable(),
});

const UnavailableGradingSchema = z.object({
  status: z.literal("unavailable"),
  reason: z.string().optional(),
});

const GradedAspectShape = {
  status: z.literal("graded"),
  score: z.number().min(1).max(5),
  explanation: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
};

export const ClaimFaithfulnessSchema = z.object({
  claim: z.string().min(1),
  faithful: z.boolean(),
  explanation: z.string().min(1),
});

export const FaithfulnessGradingSchema = z.discriminatedUnion("status", [
  UnavailableGradingSchema,
  z.object({
    ...GradedAspectShape,
    claims: z.array(ClaimFaithfulnessSchema),
  }),
]);

export const AspectGradingSchema = z.discriminatedUnion("status", [
  UnavailableGradingSchema,
  z.object(GradedAspectShape),
]);

export const EvalGradingSchema = z.object({
  faithfulness: FaithfulnessGradingSchema,
  relevance: AspectGradingSchema,
  correctness: AspectGradingSchema,
});

export const EvalCaseResultSchema = z.object({
  caseId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["completed", "error"]),
  error: z.string().nullable(),
  metrics: z.partialRecord(EvalMetricKeySchema, MetricResultSchema),
  grading: EvalGradingSchema.nullable(),
  retrievedChunkIds: z.array(z.string().min(1)),
  durationMs: z.number().nonnegative(),
});

export const EvalFailureSchema = z.object({
  caseId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["error", "failed"]),
  detail: z.string().min(1),
});

export const EvalReportSchema = z.object({
  generatedAt: z.string().datetime(),
  mode: z.enum(["retrieval", "grounded"]),
  configuration: z.object({
    datasetVersion: z.string().min(1),
    defaultConfig: SearchConfigSchema,
    answerExecutor: z.object({
      provider: z.string().min(1),
      model: z.string().min(1),
    }).nullable(),
    grader: z.object({
      provider: z.string().min(1),
      model: z.string().min(1),
    }).nullable(),
  }),
  summary: z.object({
    totalCases: z.number().int().nonnegative(),
    completedCases: z.number().int().nonnegative(),
    erroredCases: z.number().int().nonnegative(),
    metrics: z.record(EvalMetricKeySchema, MetricAggregateSchema),
  }),
  cases: z.array(EvalCaseResultSchema),
  failures: z.array(EvalFailureSchema),
});

export type MetricResult = z.infer<typeof MetricResultSchema>;
export type ClaimFaithfulness = z.infer<typeof ClaimFaithfulnessSchema>;
export type FaithfulnessGrading = z.infer<typeof FaithfulnessGradingSchema>;
export type AspectGrading = z.infer<typeof AspectGradingSchema>;
export type EvalGrading = z.infer<typeof EvalGradingSchema>;
export type EvalCaseResult = z.infer<typeof EvalCaseResultSchema>;
export type EvalFailure = z.infer<typeof EvalFailureSchema>;
export type EvalReport = z.infer<typeof EvalReportSchema>;
