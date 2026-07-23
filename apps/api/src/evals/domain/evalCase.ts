import { z } from "zod";

import { SearchConfigSchema, TenantSchema } from "@treasury-rag/contracts";

export const ExpectedEvidenceSchema = z.object({
  documentId: z.string().min(1),
  fragment: z.string().min(10),
});

export const ExpectedVersionSchema = z.object({
  documentTitle: z.string().min(1),
  version: z.number().int().positive(),
});

export const EvalCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  query: z.string().trim().min(1).max(2_000),
  tenant: TenantSchema,
  tags: z.array(z.string().min(1)).min(1),
  referenceAnswer: z.string().min(1),
  expectedEvidence: z.array(ExpectedEvidenceSchema),
  shouldAbstain: z.boolean(),
  expectedExactValues: z.array(z.string().min(1)).default([]),
  forbiddenFragments: z.array(z.string().min(1)).default([]),
  expectedVersion: ExpectedVersionSchema.optional(),
  allowedTenants: z.array(TenantSchema).min(1),
  config: SearchConfigSchema.partial().optional(),
}).superRefine((evalCase, context) => {
  if (evalCase.shouldAbstain && evalCase.expectedEvidence.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["expectedEvidence"],
      message: "An abstention case cannot expect evidence",
    });
  }
  if (!evalCase.shouldAbstain && evalCase.expectedEvidence.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["expectedEvidence"],
      message: "An answerable case must expect at least one evidence fragment",
    });
  }
});

export const EvalDatasetSchema = z.array(EvalCaseSchema).min(1);

export type ExpectedEvidence = z.infer<typeof ExpectedEvidenceSchema>;
export type ExpectedVersion = z.infer<typeof ExpectedVersionSchema>;
export type EvalCase = z.infer<typeof EvalCaseSchema>;
