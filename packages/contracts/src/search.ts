import { z } from "zod";

import { ChunkingConfigSchema, TenantSchema } from "./chunking.js";

export const SearchConfigSchema = z.object({
  chunking: ChunkingConfigSchema,
  topK: z.number().int().min(1).max(20),
  threshold: z.number().min(-1).max(1),
  tenantFilterEnabled: z.boolean(),
});

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  tenant: TenantSchema,
  config: SearchConfigSchema,
});

export const SearchResultSchema = z.object({
  rank: z.number().int().positive(),
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  tenant: TenantSchema,
  version: z.number().int().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.number().finite().min(-1).max(1),
  text: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
});

export const SearchStatsSchema = z.object({
  candidateChunks: z.number().int().nonnegative(),
  returnedChunks: z.number().int().nonnegative(),
  embeddingDimensions: z.number().int().positive(),
  cacheHits: z.number().int().nonnegative(),
  cacheMisses: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  provider: z.string().min(1),
  model: z.string().min(1),
});

export const SearchResponseSchema = z.object({
  query: z.string().min(1),
  results: z.array(SearchResultSchema),
  stats: SearchStatsSchema,
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchStats = z.infer<typeof SearchStatsSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
