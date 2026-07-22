import { z } from "zod";

import { TenantSchema } from "./chunking.js";
import {
  SearchConfigSchema,
  SearchResultSchema,
  SearchStatsSchema,
} from "./search.js";

export const GroundedClaimSchema = z.object({
  text: z.string().trim().min(1),
  citationIds: z.array(z.string().min(1)).min(1).refine(
    (citationIds) => new Set(citationIds).size === citationIds.length,
    "Citation IDs must be unique within a claim",
  ),
});

export const GroundedAnswerSchema = z.object({
  answer: z.string().trim().min(1),
  claims: z.array(GroundedClaimSchema),
  insufficientEvidence: z.boolean(),
}).superRefine((answer, context) => {
  if (!answer.insufficientEvidence && answer.claims.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["claims"],
      message: "A grounded answer must expose at least one cited claim",
    });
  }
});

export const GroundedAnswerConfigSchema = SearchConfigSchema.extend({
  tenantFilterEnabled: z.literal(true),
});

export const GroundedAnswerRequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  tenant: TenantSchema,
  config: GroundedAnswerConfigSchema,
});

const SkippedGenerationStatsSchema = z.object({
  attempted: z.literal(false),
  durationMs: z.literal(0),
  provider: z.null(),
  model: z.null(),
});

const CompletedGenerationStatsSchema = z.object({
  attempted: z.literal(true),
  durationMs: z.number().nonnegative(),
  provider: z.string().min(1),
  model: z.string().min(1),
});

export const GenerationStatsSchema = z.discriminatedUnion("attempted", [
  SkippedGenerationStatsSchema,
  CompletedGenerationStatsSchema,
]);

export const GroundedAnswerResponseSchema = GroundedAnswerSchema.safeExtend({
  query: z.string().min(1),
  tenant: TenantSchema,
  sources: z.array(SearchResultSchema),
  retrieval: SearchStatsSchema,
  generation: GenerationStatsSchema,
});

export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;
export type GroundedAnswer = z.infer<typeof GroundedAnswerSchema>;
export type GroundedAnswerConfig = z.infer<typeof GroundedAnswerConfigSchema>;
export type GroundedAnswerRequest = z.infer<typeof GroundedAnswerRequestSchema>;
export type GenerationStats = z.infer<typeof GenerationStatsSchema>;
export type GroundedAnswerResponse = z.infer<
  typeof GroundedAnswerResponseSchema
>;
