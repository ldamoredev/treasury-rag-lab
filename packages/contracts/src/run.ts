import { z } from "zod";

import { TenantSchema } from "./chunking.js";
import {
  GroundedAnswerRequestSchema,
  GroundedAnswerResponseSchema,
  GroundedAnswerSchema,
} from "./groundedAnswer.js";
import { SearchResultSchema, SearchStatsSchema } from "./search.js";

export const RunRequestSchema = GroundedAnswerRequestSchema;

export const RunCreatedResponseSchema = z.object({
  runId: z.string().min(1),
});

const RunEventBaseShape = {
  id: z.number().int().positive(),
  runId: z.string().min(1),
  timestamp: z.string().datetime(),
};

export const RunStartedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("run.started"),
  data: z.object({
    query: z.string().min(1),
    tenant: TenantSchema,
  }),
});

export const RetrievalStartedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("retrieval.started"),
  data: z.object({
    query: z.string().min(1),
  }),
});

export const RetrievalCompletedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("retrieval.completed"),
  data: z.object({
    sources: z.array(SearchResultSchema),
    stats: SearchStatsSchema,
  }),
});

export const GenerationStartedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("generation.started"),
  data: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
  }),
});

export const AnswerDeltaEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("answer.delta"),
  data: z.object({
    delta: z.string().min(1),
  }),
});

export const AnswerCompletedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("answer.completed"),
  data: GroundedAnswerSchema,
});

export const EvaluationCompletedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("evaluation.completed"),
  data: z.object({
    citationValidity: z.boolean(),
    tenantLeakage: z.boolean(),
  }),
});

export const RunCompletedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("run.completed"),
  data: z.object({
    response: GroundedAnswerResponseSchema,
  }),
});

export const RunFailedEventSchema = z.object({
  ...RunEventBaseShape,
  type: z.literal("run.failed"),
  data: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export const RunEventSchema = z.discriminatedUnion("type", [
  RunStartedEventSchema,
  RetrievalStartedEventSchema,
  RetrievalCompletedEventSchema,
  GenerationStartedEventSchema,
  AnswerDeltaEventSchema,
  AnswerCompletedEventSchema,
  EvaluationCompletedEventSchema,
  RunCompletedEventSchema,
  RunFailedEventSchema,
]);

export type RunRequest = z.infer<typeof RunRequestSchema>;
export type RunCreatedResponse = z.infer<typeof RunCreatedResponseSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type RunEventType = RunEvent["type"];
