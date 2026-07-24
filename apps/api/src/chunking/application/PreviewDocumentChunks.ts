import {
  ChunkPreviewResponseSchema,
  type ChunkPreviewRequest,
  type ChunkPreviewResponse,
  type ContextualizedChunk,
  type Document,
} from "@treasury-rag/contracts";

import { DocumentNotFoundError } from "../../documents/application/DocumentNotFoundError.js";
import type { DocumentRepository } from "../../documents/ports/DocumentRepository.js";
import type { DocumentIngestionPipeline } from "../../ingestion/application/DocumentIngestionPipeline.js";
import type { ChunkContextualizer } from "../../ingestion/ports/ChunkContextualizer.js";
import type { TokenCounter } from "../../ingestion/ports/TokenCounter.js";

function calculateStats(
  document: Document,
  documentTokens: number,
  chunks: ContextualizedChunk[],
) {
  const lengths = chunks.map((chunk) => chunk.text.length);
  const tokenCounts = chunks.map((chunk) => chunk.tokenCount);
  const totalChunkCharacters = sum(lengths);

  return {
    documentCharacters: document.content.length,
    chunkCount: chunks.length,
    duplicatedCharacters: Math.max(
      0,
      totalChunkCharacters - document.content.length,
    ),
    minimumChunkCharacters: lengths.length === 0 ? 0 : Math.min(...lengths),
    maximumChunkCharacters: lengths.length === 0 ? 0 : Math.max(...lengths),
    averageChunkCharacters: lengths.length === 0
      ? 0
      : totalChunkCharacters / lengths.length,
    documentTokens,
    minimumChunkTokens: tokenCounts.length === 0 ? 0 : Math.min(...tokenCounts),
    maximumChunkTokens: tokenCounts.length === 0 ? 0 : Math.max(...tokenCounts),
    averageChunkTokens: tokenCounts.length === 0
      ? 0
      : sum(tokenCounts) / tokenCounts.length,
    // What the configuration actually costs to embed: tokens sent on top of
    // the document's own tokens, counting both overlap and added context.
    contextualTokens: Math.max(0, sum(tokenCounts) - documentTokens),
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export class PreviewDocumentChunks {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly ingestion: DocumentIngestionPipeline,
    private readonly tokens: TokenCounter,
    private readonly contextualizer: ChunkContextualizer,
  ) {}

  async execute(request: ChunkPreviewRequest): Promise<ChunkPreviewResponse> {
    const document = this.documents.findById(request.documentId);
    if (!document) {
      throw new DocumentNotFoundError(request.documentId);
    }

    await this.tokens.load();
    const { chunks, manifest } = await this.ingestion.ingest({
      documents: [document],
      chunking: request.config,
      contextualizer: this.contextualizer,
    });

    return ChunkPreviewResponseSchema.parse({
      document: {
        id: document.id,
        title: document.title,
        tenant: document.tenant,
        version: document.version,
        effectiveFrom: document.effectiveFrom,
      },
      config: request.config,
      chunks,
      stats: calculateStats(
        document,
        manifest.documents[0]?.documentTokens ?? 0,
        chunks,
      ),
      contextualization: {
        enabled: manifest.contextualizer.id !== "none",
        contextualizer: manifest.contextualizer.id,
        model: manifest.contextualizer.model,
        promptVersion: manifest.contextualizer.promptVersion,
        tokenizer: manifest.tokenizer.model,
      },
    });
  }
}
