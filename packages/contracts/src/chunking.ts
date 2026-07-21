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

export const ChunkSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  text: z.string().min(1),
  index: z.number().int().nonnegative(),
  tenant: TenantSchema,
  version: z.number().int().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
}).refine((chunk) => chunk.endOffset > chunk.startOffset, {
  message: "endOffset must be greater than startOffset",
  path: ["endOffset"],
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

export const ChunkingConfigSchema = z.union([
  CharacterChunkingConfigSchema,
  HeadingChunkingConfigSchema,
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
});

export const ChunkPreviewResponseSchema = z.object({
  document: DocumentSummarySchema,
  config: ChunkingConfigSchema,
  chunks: z.array(ChunkSchema),
  stats: ChunkStatsSchema,
});

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentSummarySchema),
});

export type Tenant = z.infer<typeof TenantSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type CharacterChunkingConfig = z.infer<
  typeof CharacterChunkingConfigSchema
>;
export type HeadingChunkingConfig = z.infer<
  typeof HeadingChunkingConfigSchema
>;
export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;
export type ChunkPreviewRequest = z.infer<typeof ChunkPreviewRequestSchema>;
export type ChunkStats = z.infer<typeof ChunkStatsSchema>;
export type ChunkPreviewResponse = z.infer<typeof ChunkPreviewResponseSchema>;
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;
