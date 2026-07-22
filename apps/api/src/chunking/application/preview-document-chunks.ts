import {
  ChunkPreviewResponseSchema,
  type Chunk,
  type ChunkPreviewRequest,
  type ChunkPreviewResponse,
  type Document,
} from "@treasury-rag/contracts";

import type { DocumentRepository } from "../../documents/ports/document-repository.js";
import { DocumentNotFoundError } from "../../documents/application/document-not-found-error.js";
import type { DocumentChunker } from "../domain/document-chunker.js";

function calculateStats(document: Document, chunks: Chunk[]) {
  const lengths = chunks.map((chunk) => chunk.text.length);
  const totalChunkCharacters = lengths.reduce(
    (total, length) => total + length,
    0,
  );

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
  };
}

export class PreviewDocumentChunks {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly chunker: DocumentChunker,
  ) {}

  execute(request: ChunkPreviewRequest): ChunkPreviewResponse {
    const document = this.documents.findById(request.documentId);
    if (!document) {
      throw new DocumentNotFoundError(request.documentId);
    }
    const chunks = this.chunker.chunk(document, request.config);

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
      stats: calculateStats(document, chunks),
    });
  }
}
