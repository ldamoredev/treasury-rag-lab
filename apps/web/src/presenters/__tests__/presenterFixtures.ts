import type {
  ChunkPreviewRequest,
  ChunkPreviewResponse,
  DocumentListResponse,
  GroundedAnswerRequest,
  GroundedAnswerResponse,
  RunEvent,
  SearchRequest,
  SearchResponse,
} from "@treasury-rag/contracts";

import type {
  GatewayRequestOptions,
  RunObserver,
  RunStream,
  TreasuryRagGateway,
} from "../../core/ports/TreasuryRagGateway";

export const documentsResponse: DocumentListResponse = {
  documents: [{
    id: "partial-payments",
    title: "Política global",
    tenant: "global",
    version: 2,
    effectiveFrom: "2026-01-15",
  }],
};

export const previewResponse: ChunkPreviewResponse = {
  document: documentsResponse.documents[0]!,
  config: { strategy: "characters", chunkSize: 300, overlap: 80 },
  chunks: [{
    id: "partial-payments:characters:300:80:0",
    documentId: "partial-payments",
    text: "Texto de política",
    index: 0,
    tenant: "global",
    version: 2,
    effectiveFrom: "2026-01-15",
    startOffset: 0,
    endOffset: 17,
  }],
  stats: {
    documentCharacters: 17,
    chunkCount: 1,
    duplicatedCharacters: 0,
    minimumChunkCharacters: 17,
    maximumChunkCharacters: 17,
    averageChunkCharacters: 17,
  },
};

export const searchResponse: SearchResponse = {
  query: "pago parcial",
  results: [],
  stats: {
    candidateChunks: 3,
    returnedChunks: 0,
    embeddingDimensions: 384,
    cacheHits: 3,
    cacheMisses: 0,
    durationMs: 2,
    provider: "fake",
    model: "fake-e5",
  },
};

export class FakeTreasuryRagGateway implements TreasuryRagGateway {
  readonly previewCalls: ChunkPreviewRequest[] = [];
  readonly searchCalls: SearchRequest[] = [];
  readonly runCalls: GroundedAnswerRequest[] = [];
  readonly signals: AbortSignal[] = [];
  runEvents: RunEvent[] = [];
  previewResult: Promise<ChunkPreviewResponse> | undefined;
  searchResult: Promise<SearchResponse> | undefined;
  stream: RunStream = { close() {} };

  async listDocuments(options: GatewayRequestOptions = {}) {
    this.captureSignal(options);
    return documentsResponse;
  }

  async previewChunks(
    request: ChunkPreviewRequest,
    options: GatewayRequestOptions = {},
  ) {
    this.previewCalls.push(request);
    this.captureSignal(options);
    return this.previewResult ?? previewResponse;
  }

  async search(
    request: SearchRequest,
    options: GatewayRequestOptions = {},
  ) {
    this.searchCalls.push(request);
    this.captureSignal(options);
    return this.searchResult ?? searchResponse;
  }

  async answer(
    _request: GroundedAnswerRequest,
    _options: GatewayRequestOptions = {},
  ): Promise<GroundedAnswerResponse> {
    throw new Error("Not configured");
  }

  async startRun(
    request: GroundedAnswerRequest,
    observer: RunObserver,
    options: GatewayRequestOptions = {},
  ): Promise<RunStream> {
    this.runCalls.push(request);
    this.captureSignal(options);
    for (const event of this.runEvents) {
      observer.onEvent(event);
    }
    return this.stream;
  }

  private captureSignal(options: GatewayRequestOptions) {
    if (options.signal) {
      this.signals.push(options.signal);
    }
  }
}
