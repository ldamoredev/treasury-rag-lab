import type {
  ChunkingConfig,
  GroundedAnswerResponse,
  RunEvent,
  RunEventType,
  SearchResult,
  Tenant,
} from "@treasury-rag/contracts";

import type {
  RunStream,
  TreasuryRagGateway,
} from "../core/ports/TreasuryRagGateway";
import {
  errorMessage,
  isAbortError,
} from "./presentationFormat";

type ChunkingStrategy = ChunkingConfig["strategy"];
type RetrievalProgress = Extract<
  RunEvent,
  { type: "retrieval.completed" }
>["data"];
type RunEvaluation = Extract<
  RunEvent,
  { type: "evaluation.completed" }
>["data"];

export type InspectorTab =
  | "retrieval"
  | "context"
  | "trace"
  | "metrics"
  | "settings";

export type InspectorTabVM = {
  id: InspectorTab;
  label: string;
  badge: string | undefined;
};

const EVENT_LABELS: Record<RunEventType, string> = {
  "run.started": "Run iniciado",
  "retrieval.started": "Retrieval iniciado",
  "retrieval.completed": "Retrieval completo",
  "generation.started": "Generación iniciada",
  "answer.delta": "Delta recibido",
  "answer.completed": "Respuesta completa",
  "evaluation.completed": "Evaluación completa",
  "run.completed": "Run completo",
  "run.failed": "Run fallido",
};

export type RunTraceVM = {
  id: number;
  number: string;
  type: RunEventType;
  typeClass: string;
  label: string;
  timestamp: string;
};

export type GroundedClaimVM = {
  number: string;
  text: string;
  citationIds: string[];
};

export type GroundedSourceVM = {
  chunkId: string;
  rank: string;
  documentTitle: string;
  metadata: string;
  score: string;
  text: string;
  offsets: string;
};

export type GroundedAnswerLabViewModel = {
  query: string;
  tenant: Tenant;
  chunkingStrategy: ChunkingStrategy;
  chunkSize: number;
  overlap: number;
  maxChunkSize: number;
  topK: number;
  threshold: number;
  thresholdLabel: string;
  isLoading: boolean;
  error: string | undefined;
  currentStage: string;
  streamedAnswer: string;
  submittedQuestion: {
    text: string;
    tenant: Tenant;
  } | undefined;
  responseTitle: string;
  activeInspectorTab: InspectorTab;
  inspectorTabs: InspectorTabVM[];
  trace: RunTraceVM[];
  answer: {
    text: string;
    insufficientEvidence: boolean;
    status: string;
    claimsCount: string;
  } | undefined;
  stats: {
    retrievalChunks: string;
    retrievalDuration: string;
    generationDuration: string;
    model: string;
  } | undefined;
  retrieval: {
    candidateChunks: number;
    returnedChunks: number;
    cache: string;
    duration: string;
    provider: string;
    model: string;
    dimensions: string;
    contextCharacters: number;
  } | undefined;
  evaluation: RunEvaluation | undefined;
  runSummary: {
    eventCount: number;
    deltaCount: number;
    duration: string;
  } | undefined;
  claims: GroundedClaimVM[];
  sources: GroundedSourceVM[];
};

export class GroundedAnswerLabPresenter {
  private query = "¿Un pago parcial cancela la factura?";
  private tenant: Tenant = "acme";
  private chunkingStrategy: ChunkingStrategy = "characters";
  private chunkSize = 300;
  private overlap = 80;
  private maxChunkSize = 600;
  private topK = 5;
  private threshold = 0.7;
  private response: GroundedAnswerResponse | undefined;
  private streamedAnswer = "";
  private trace: RunEvent[] = [];
  private submittedQuestion: { text: string; tenant: Tenant } | undefined;
  private retrieval: RetrievalProgress | undefined;
  private evaluation: RunEvaluation | undefined;
  private activeInspectorTab: InspectorTab = "retrieval";
  private currentStage = "Esperando pregunta";
  private error: string | undefined;
  private isLoading = false;
  private started = false;
  private session = 0;
  private request: AbortController | undefined;
  private stream: RunStream | undefined;
  private currentModel: GroundedAnswerLabViewModel;

  constructor(
    private readonly onChange: () => void,
    private readonly gateway: TreasuryRagGateway,
  ) {
    this.currentModel = this.buildModel();
  }

  get model(): GroundedAnswerLabViewModel {
    return this.currentModel;
  }

  start(): void {
    if (!this.started) {
      this.started = true;
      this.session += 1;
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.session += 1;
    this.request?.abort();
    this.request = undefined;
    this.stream?.close();
    this.stream = undefined;
    this.isLoading = false;
    this.currentModel = this.buildModel();
  }

  setQuery(query: string): void {
    this.query = query;
    this.refresh();
  }

  setTenant(tenant: Tenant): void {
    this.tenant = tenant;
    this.refresh();
  }

  setChunkingStrategy(strategy: ChunkingStrategy): void {
    this.chunkingStrategy = strategy;
    this.refresh();
  }

  setChunkSize(value: number): void {
    this.chunkSize = Math.max(1, Math.min(5_000, value));
    this.overlap = Math.min(this.overlap, this.chunkSize - 1);
    this.refresh();
  }

  setOverlap(value: number): void {
    this.overlap = Math.max(0, Math.min(this.chunkSize - 1, value));
    this.refresh();
  }

  setMaxChunkSize(value: number): void {
    this.maxChunkSize = Math.max(1, Math.min(5_000, value));
    this.refresh();
  }

  setTopK(value: number): void {
    this.topK = Math.max(1, Math.min(20, value));
    this.refresh();
  }

  setThreshold(value: number): void {
    this.threshold = Math.max(-1, Math.min(1, value));
    this.refresh();
  }

  selectInspectorTab(tab: InspectorTab): void {
    if (this.activeInspectorTab !== tab) {
      this.activeInspectorTab = tab;
      this.refresh();
    }
  }

  async submit(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.request?.abort();
    this.stream?.close();
    this.stream = undefined;
    const request = new AbortController();
    const session = this.session;
    this.request = request;
    this.response = undefined;
    this.submittedQuestion = { text: this.query, tenant: this.tenant };
    this.retrieval = undefined;
    this.evaluation = undefined;
    this.streamedAnswer = "";
    this.trace = [];
    this.error = undefined;
    this.isLoading = true;
    this.currentStage = "Creando run…";
    this.refresh();

    try {
      const stream = await this.gateway.startRun(
        {
          query: this.query,
          tenant: this.tenant,
          config: {
            chunking: this.chunkingConfig(),
            topK: this.topK,
            threshold: this.threshold,
            tenantFilterEnabled: true,
          },
        },
        {
          onEvent: (event) => this.receive(event, session),
          onError: (error) => this.fail(error, session),
          onReconnecting: () => this.reconnecting(session),
        },
        { signal: request.signal },
      );

      if (this.isCurrent(session, request.signal)) {
        this.stream = stream;
      } else {
        stream.close();
      }
    } catch (error) {
      if (this.isCurrent(session, request.signal) && !isAbortError(error)) {
        this.fail(error, session);
      }
    }
  }

  private receive(event: RunEvent, session: number): void {
    if (!this.started || this.session !== session) {
      return;
    }
    this.trace = [...this.trace, event];

    switch (event.type) {
      case "run.started":
        this.currentStage = "Run conectado";
        break;
      case "retrieval.started":
        this.currentStage = "Buscando evidencia…";
        break;
      case "retrieval.completed":
        this.retrieval = event.data;
        this.currentStage = `${event.data.sources.length} chunks recuperados`;
        break;
      case "generation.started":
        this.currentStage = `Generando con ${event.data.model}…`;
        break;
      case "answer.delta":
        this.currentStage = "Transmitiendo respuesta…";
        this.streamedAnswer += event.data.delta;
        break;
      case "answer.completed":
        this.currentStage = "Validando grounding…";
        this.streamedAnswer = event.data.answer;
        break;
      case "evaluation.completed":
        this.evaluation = event.data;
        this.currentStage = "Evaluación determinística completa";
        break;
      case "run.completed":
        this.response = event.data.response;
        this.currentStage = "Run completo";
        this.isLoading = false;
        break;
      case "run.failed":
        this.error = event.data.message;
        this.currentStage = "Run fallido";
        this.isLoading = false;
        break;
    }
    this.refresh();
  }

  private reconnecting(session: number): void {
    if (this.started && this.session === session) {
      this.currentStage = "Reconectando SSE…";
      this.refresh();
    }
  }

  private fail(error: unknown, session: number): void {
    if (!this.started || this.session !== session) {
      return;
    }
    this.error = errorMessage(error);
    this.currentStage = "Evento inválido";
    this.isLoading = false;
    this.stream?.close();
    this.refresh();
  }

  private isCurrent(session: number, signal: AbortSignal): boolean {
    return this.started && this.session === session && !signal.aborted;
  }

  private chunkingConfig(): ChunkingConfig {
    return this.chunkingStrategy === "characters"
      ? {
          strategy: "characters",
          chunkSize: this.chunkSize,
          overlap: this.overlap,
        }
      : { strategy: "headings", maxChunkSize: this.maxChunkSize };
  }

  private refresh(): void {
    this.currentModel = this.buildModel();
    this.onChange();
  }

  private buildModel(): GroundedAnswerLabViewModel {
    const sources = this.response?.sources ?? this.retrieval?.sources ?? [];
    const retrieval = this.response?.retrieval ?? this.retrieval?.stats;

    return {
      query: this.query,
      tenant: this.tenant,
      chunkingStrategy: this.chunkingStrategy,
      chunkSize: this.chunkSize,
      overlap: this.overlap,
      maxChunkSize: this.maxChunkSize,
      topK: this.topK,
      threshold: this.threshold,
      thresholdLabel: this.threshold.toFixed(2),
      isLoading: this.isLoading,
      error: this.error,
      currentStage: this.currentStage,
      streamedAnswer: this.streamedAnswer,
      submittedQuestion: this.submittedQuestion,
      responseTitle: this.response
        ? `Respuesta para ${this.response.tenant}`
        : "Preguntale al corpus",
      activeInspectorTab: this.activeInspectorTab,
      inspectorTabs: [
        { id: "retrieval", label: "Retrieval", badge: sources.length > 0 ? String(sources.length) : undefined },
        { id: "context", label: "Context", badge: sources.length > 0 ? String(sources.length) : undefined },
        { id: "trace", label: "Trace", badge: this.trace.length > 0 ? String(this.trace.length) : undefined },
        { id: "metrics", label: "Metrics", badge: this.evaluation ? "✓" : undefined },
        { id: "settings", label: "Settings", badge: undefined },
      ],
      trace: this.trace.map((event) => ({
        id: event.id,
        number: String(event.id).padStart(2, "0"),
        type: event.type,
        typeClass: event.type.replaceAll(".", "-"),
        label: EVENT_LABELS[event.type],
        timestamp: new Date(event.timestamp).toLocaleTimeString(),
      })),
      answer: this.response
        ? {
            text: this.response.answer,
            insufficientEvidence: this.response.insufficientEvidence,
            status: this.response.insufficientEvidence
              ? "Evidencia insuficiente"
              : "Respuesta grounded",
            claimsCount: `${this.response.claims.length} claims`,
          }
        : undefined,
      stats: this.response ? this.responseStats(this.response) : undefined,
      retrieval: retrieval
        ? {
            candidateChunks: retrieval.candidateChunks,
            returnedChunks: retrieval.returnedChunks,
            cache: `${retrieval.cacheHits} hit / ${retrieval.cacheMisses} miss`,
            duration: `${Math.round(retrieval.durationMs)} ms`,
            provider: retrieval.provider,
            model: retrieval.model,
            dimensions: `${retrieval.embeddingDimensions}d`,
            contextCharacters: sources.reduce(
              (total, source) => total + source.text.length,
              0,
            ),
          }
        : undefined,
      evaluation: this.evaluation,
      runSummary: this.trace.length > 0
        ? {
            eventCount: this.trace.length,
            deltaCount: this.trace.filter((event) => event.type === "answer.delta").length,
            duration: this.runDuration(),
          }
        : undefined,
      claims: this.response?.claims.map((claim, index) => ({
        number: String(index + 1).padStart(2, "0"),
        text: claim.text,
        citationIds: claim.citationIds,
      })) ?? [],
      sources: sources.map((source) => this.sourceVM(source)),
    };
  }

  private runDuration(): string {
    const first = this.trace[0];
    const last = this.trace.at(-1);
    if (!first || !last) {
      return "0 ms";
    }
    const milliseconds = Math.max(
      0,
      Date.parse(last.timestamp) - Date.parse(first.timestamp),
    );
    return `${milliseconds} ms`;
  }

  private responseStats(response: GroundedAnswerResponse) {
    return {
      retrievalChunks: `${response.retrieval.returnedChunks} chunks recuperados`,
      retrievalDuration: `${Math.round(response.retrieval.durationMs)} ms retrieval`,
      generationDuration: response.generation.attempted
        ? `${Math.round(response.generation.durationMs)} ms generación`
        : "generación omitida",
      model: response.generation.attempted
        ? `${response.generation.provider}/${response.generation.model}`
        : response.retrieval.model,
    };
  }

  private sourceVM(source: SearchResult): GroundedSourceVM {
    return {
      chunkId: source.chunkId,
      rank: `#${source.rank}`,
      documentTitle: source.documentTitle,
      metadata: `${source.tenant} · v${source.version} · ${source.effectiveFrom}`,
      score: source.score.toFixed(4),
      text: source.text,
      offsets: `${source.startOffset}–${source.endOffset}`,
    };
  }
}
