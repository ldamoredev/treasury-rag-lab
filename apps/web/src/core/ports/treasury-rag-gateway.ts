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

export type GatewayRequestOptions = {
  signal?: AbortSignal;
};

export type RunObserver = {
  onEvent(event: RunEvent): void;
  onError(error: unknown): void;
  onReconnecting(): void;
};

export interface RunStream {
  close(): void;
}

export interface TreasuryRagGateway {
  listDocuments(options?: GatewayRequestOptions): Promise<DocumentListResponse>;
  previewChunks(
    request: ChunkPreviewRequest,
    options?: GatewayRequestOptions,
  ): Promise<ChunkPreviewResponse>;
  search(
    request: SearchRequest,
    options?: GatewayRequestOptions,
  ): Promise<SearchResponse>;
  answer(
    request: GroundedAnswerRequest,
    options?: GatewayRequestOptions,
  ): Promise<GroundedAnswerResponse>;
  startRun(
    request: GroundedAnswerRequest,
    observer: RunObserver,
    options?: GatewayRequestOptions,
  ): Promise<RunStream>;
}
