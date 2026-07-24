import type {
  ChunkPreviewRequest,
  ChunkPreviewResponse,
  DocumentListResponse,
  FailureLabComparisonRequest,
  FailureLabComparisonResponse,
  FailureLabExperimentListResponse,
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
    contextualPrefix: "[documento: Política global · tenant: global · versión: v2]",
    embeddingText:
      "[documento: Política global · tenant: global · versión: v2]\nTexto de política",
    embeddingKey: "key-0",
    tokenCount: 14,
  }],
  stats: {
    documentCharacters: 17,
    chunkCount: 1,
    duplicatedCharacters: 0,
    minimumChunkCharacters: 17,
    maximumChunkCharacters: 17,
    averageChunkCharacters: 17,
    documentTokens: 3,
    minimumChunkTokens: 14,
    maximumChunkTokens: 14,
    averageChunkTokens: 14,
    contextualTokens: 11,
  },
  contextualization: {
    enabled: true,
    contextualizer: "metadata-heading-path",
    model: "deterministic",
    promptVersion: "2026-07-metadata-v1",
    tokenizer: "Xenova/multilingual-e5-small",
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
    contextualizer: "metadata-heading-path",
    tokenizer: "Xenova/multilingual-e5-small",
  },
};

export const failureLabExperimentsResponse: FailureLabExperimentListResponse = {
  experiments: [
    {
      id: "tenant-filter-on-vs-off",
      name: "Tenant filter: on vs off",
      description: "Compara el aislamiento de tenant contra un retrieval sin filtro.",
      variable: "tenantFilter",
      baseline: {
        chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
        topK: 5,
        threshold: 0.7,
        tenantFilterEnabled: true,
        latestVersionOnly: true,
        contextualIngestion: false,
      },
      variant: {
        chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
        topK: 5,
        threshold: 0.7,
        tenantFilterEnabled: false,
        latestVersionOnly: true,
        contextualIngestion: false,
      },
      responsibleLayer: "filtering",
      suggestedFix: "Reactivar el filtro de tenant.",
      learning: "La fuga entre tenants ocurre en retrieval.",
    },
  ],
};

export const failureLabComparisonResponse: FailureLabComparisonResponse = {
  experiment: failureLabExperimentsResponse.experiments[0]!,
  mode: "retrieval",
  generatedAt: "2026-07-22T12:00:00.000Z",
  metricDeltas: [
    {
      metric: "tenantLeakage",
      label: "Fuga entre tenants",
      baseline: { passed: 10, failed: 0, notApplicable: 0, rate: 1 },
      variant: { passed: 6, failed: 4, notApplicable: 0, rate: 0.6 },
      delta: -0.4,
    },
    {
      metric: "citationValidity",
      label: "Validez de citas",
      baseline: { passed: 0, failed: 0, notApplicable: 10, rate: null },
      variant: { passed: 0, failed: 0, notApplicable: 10, rate: null },
      delta: null,
    },
  ],
  improvedCases: [],
  degradedCases: [
    {
      caseId: "acme-exclusive-rule",
      name: "Regla exclusiva de Acme",
      baselineStatus: "passed",
      variantStatus: "failed",
      detail: "tenantLeakage: passed → failed",
    },
  ],
  unchangedCases: 9,
  observedFailure: "La variante degradó 1 caso(s): acme-exclusive-rule.",
  responsibleLayer: "filtering",
  suggestedFix: "Reactivar el filtro de tenant.",
};

export class FakeTreasuryRagGateway implements TreasuryRagGateway {
  readonly previewCalls: ChunkPreviewRequest[] = [];
  readonly searchCalls: SearchRequest[] = [];
  readonly runCalls: GroundedAnswerRequest[] = [];
  readonly comparisonCalls: FailureLabComparisonRequest[] = [];
  readonly signals: AbortSignal[] = [];
  runEvents: RunEvent[] = [];
  previewResult: Promise<ChunkPreviewResponse> | undefined;
  searchResult: Promise<SearchResponse> | undefined;
  experimentListResult: Promise<FailureLabExperimentListResponse> | undefined;
  comparisonResult: Promise<FailureLabComparisonResponse> | undefined;
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

  async listFailureLabExperiments(options: GatewayRequestOptions = {}) {
    this.captureSignal(options);
    return this.experimentListResult ?? failureLabExperimentsResponse;
  }

  async compareFailureLabExperiment(
    request: FailureLabComparisonRequest,
    options: GatewayRequestOptions = {},
  ) {
    this.comparisonCalls.push(request);
    this.captureSignal(options);
    return this.comparisonResult ?? failureLabComparisonResponse;
  }

  private captureSignal(options: GatewayRequestOptions) {
    if (options.signal) {
      this.signals.push(options.signal);
    }
  }
}
