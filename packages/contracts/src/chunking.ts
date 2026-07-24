import { z } from "zod";

export const TenantSchema = z.enum(["global", "acme", "boreal"]);

export const DocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  tenant: TenantSchema,
  version: z.number().int().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const DocumentSummarySchema = DocumentSchema.omit({ content: true });

/**
 * `text` is the citation text: an exact slice of the source document. Nothing
 * generated during ingestion is ever added to it, so a citation can always be
 * traced back to the document byte for byte.
 */
const ChunkFieldsSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  text: z.string().min(1),
  index: z.number().int().nonnegative(),
  tenant: TenantSchema,
  version: z.number().int().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
});

const hasOrderedOffsets = {
  check: (chunk: { startOffset: number; endOffset: number }) =>
    chunk.endOffset > chunk.startOffset,
  message: "endOffset must be greater than startOffset",
  path: ["endOffset"] as const,
};

export const ChunkSchema = ChunkFieldsSchema.refine(hasOrderedOffsets.check, {
  message: hasOrderedOffsets.message,
  path: [...hasOrderedOffsets.path],
});

/**
 * A chunk plus the ingestion-time context used to retrieve it. The prefix and
 * the embedding text exist only to build a vector; they are never citable and
 * never replace `text`.
 */
export const ContextualizedChunkSchema = ChunkFieldsSchema.extend({
  contextualPrefix: z.string(),
  embeddingText: z.string().min(1),
  embeddingKey: z.string().min(1),
  tokenCount: z.number().int().nonnegative(),
}).refine(hasOrderedOffsets.check, {
  message: hasOrderedOffsets.message,
  path: [...hasOrderedOffsets.path],
});

export const CharacterChunkingConfigSchema = z.object({
  strategy: z.literal("characters"),
  chunkSize: z.number().int().min(1).max(5_000),
  overlap: z.number().int().min(0),
}).refine((config) => config.overlap < config.chunkSize, {
  message: "overlap must be smaller than chunkSize",
  path: ["overlap"],
});

export const HeadingChunkingConfigSchema = z.object({
  strategy: z.literal("headings"),
  maxChunkSize: z.number().int().min(1).max(5_000),
});

/**
 * Token budgets are what the embedding model and the generation prompt
 * actually spend. Character budgets only approximate them, and the ratio is
 * language dependent: Spanish treasury prose runs above five characters per
 * token on this tokenizer, so a 300-character window is far smaller than the
 * usual four-characters-per-token rule of thumb suggests.
 */
export const TokenChunkingConfigSchema = z.object({
  strategy: z.literal("tokens"),
  maxTokens: z.number().int().min(4).max(1_024),
  overlapTokens: z.number().int().min(0),
}).refine((config) => config.overlapTokens < config.maxTokens, {
  message: "overlapTokens must be smaller than maxTokens",
  path: ["overlapTokens"],
});

export const ChunkingConfigSchema = z.union([
  CharacterChunkingConfigSchema,
  HeadingChunkingConfigSchema,
  TokenChunkingConfigSchema,
]);

export const ChunkPreviewRequestSchema = z.object({
  documentId: z.string().min(1),
  config: ChunkingConfigSchema,
});

export const ChunkStatsSchema = z.object({
  documentCharacters: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  duplicatedCharacters: z.number().int().nonnegative(),
  minimumChunkCharacters: z.number().int().nonnegative(),
  maximumChunkCharacters: z.number().int().nonnegative(),
  averageChunkCharacters: z.number().nonnegative(),
  documentTokens: z.number().int().nonnegative(),
  minimumChunkTokens: z.number().int().nonnegative(),
  maximumChunkTokens: z.number().int().nonnegative(),
  averageChunkTokens: z.number().nonnegative(),
  contextualTokens: z.number().int().nonnegative(),
});

export const ContextualizationInfoSchema = z.object({
  enabled: z.boolean(),
  contextualizer: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  tokenizer: z.string().min(1),
});

export const ChunkPreviewResponseSchema = z.object({
  document: DocumentSummarySchema,
  config: ChunkingConfigSchema,
  chunks: z.array(ContextualizedChunkSchema),
  stats: ChunkStatsSchema,
  contextualization: ContextualizationInfoSchema,
});

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentSummarySchema),
});

export type Tenant = z.infer<typeof TenantSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type ContextualizedChunk = z.infer<typeof ContextualizedChunkSchema>;
export type ContextualizationInfo = z.infer<typeof ContextualizationInfoSchema>;
export type CharacterChunkingConfig = z.infer<
  typeof CharacterChunkingConfigSchema
>;
export type HeadingChunkingConfig = z.infer<
  typeof HeadingChunkingConfigSchema
>;
export type TokenChunkingConfig = z.infer<typeof TokenChunkingConfigSchema>;
export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;
export type ChunkPreviewRequest = z.infer<typeof ChunkPreviewRequestSchema>;
export type ChunkStats = z.infer<typeof ChunkStatsSchema>;
export type ChunkPreviewResponse = z.infer<typeof ChunkPreviewResponseSchema>;
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;
