import type {
  ChunkingConfig,
  ContextualizedChunk,
  Document,
  Tenant,
} from "@treasury-rag/contracts";

export type IngestedChunkEntry = {
  chunkId: string;
  startOffset: number;
  endOffset: number;
  characters: number;
  tokenCount: number;
  embeddingKey: string;
};

export type IngestedDocumentEntry = {
  documentId: string;
  tenant: Tenant;
  version: number;
  effectiveFrom: string;
  contentHash: string;
  characters: number;
  documentTokens: number;
  chunkCount: number;
  chunks: IngestedChunkEntry[];
};

export type IngestionManifest = {
  manifestVersion: 1;
  chunking: ChunkingConfig;
  tokenizer: { id: string; model: string };
  contextualizer: { id: string; model: string; promptVersion: string };
  documents: IngestedDocumentEntry[];
  totals: {
    documents: number;
    chunks: number;
    documentTokens: number;
    embeddingTokens: number;
  };
};

export type ManifestInput = {
  chunking: ChunkingConfig;
  tokenizer: { id: string; model: string };
  contextualizer: { id: string; model: string; promptVersion: string };
  documents: {
    document: Document;
    contentHash: string;
    documentTokens: number;
    chunks: ContextualizedChunk[];
  }[];
};

/**
 * A reproducible description of what was indexed and how. Two ingestions of
 * the same corpus with the same configuration serialize identically, so a
 * changed manifest is evidence that something real changed — the corpus, the
 * chunking, the tokenizer or the contextualizer — and not that ingestion is
 * non-deterministic.
 */
export function buildIngestionManifest(
  input: ManifestInput,
): IngestionManifest {
  const documents = input.documents.map(
    ({ document, contentHash, documentTokens, chunks }) => ({
      documentId: document.id,
      tenant: document.tenant,
      version: document.version,
      effectiveFrom: document.effectiveFrom,
      contentHash,
      characters: document.content.length,
      documentTokens,
      chunkCount: chunks.length,
      chunks: chunks.map((chunk) => ({
        chunkId: chunk.id,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        characters: chunk.text.length,
        tokenCount: chunk.tokenCount,
        embeddingKey: chunk.embeddingKey,
      })),
    }),
  );

  return {
    manifestVersion: 1,
    chunking: input.chunking,
    tokenizer: input.tokenizer,
    contextualizer: input.contextualizer,
    documents,
    totals: {
      documents: documents.length,
      chunks: sum(documents.map((entry) => entry.chunkCount)),
      documentTokens: sum(documents.map((entry) => entry.documentTokens)),
      embeddingTokens: sum(
        documents.flatMap((entry) =>
          entry.chunks.map((chunk) => chunk.tokenCount)
        ),
      ),
    },
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
