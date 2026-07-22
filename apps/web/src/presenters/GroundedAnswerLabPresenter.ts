import type {
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
  topK: number;
  threshold: number;
  thresholdLabel: string;
  isLoading: boolean;
  error: string | undefined;
  currentStage: string;
  streamedAnswer: string;
  responseTitle: string;
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
  claims: GroundedClaimVM[];
  sources: GroundedSourceVM[];
};

export class GroundedAnswerLabPresenter {
  private query = "¿Un pago parcial cancela la factura?";
  private tenant: Tenant = "acme";
  private topK = 5;
  private threshold = 0.7;
  private response: GroundedAnswerResponse | undefined;
  private streamedAnswer = "";
  private trace: RunEvent[] = [];
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

  setTopK(value: number): void {
    this.topK = Math.max(1, Math.min(20, value));
    this.refresh();
  }

  setThreshold(value: number): void {
    this.threshold = Math.max(-1, Math.min(1, value));
    this.refresh();
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
            chunking: {
              strategy: "characters",
              chunkSize: 300,
              overlap: 80,
            },
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

  private refresh(): void {
    this.currentModel = this.buildModel();
    this.onChange();
  }

  private buildModel(): GroundedAnswerLabViewModel {
    return {
      query: this.query,
      tenant: this.tenant,
      topK: this.topK,
      threshold: this.threshold,
      thresholdLabel: this.threshold.toFixed(2),
      isLoading: this.isLoading,
      error: this.error,
      currentStage: this.currentStage,
      streamedAnswer: this.streamedAnswer,
      responseTitle: this.response
        ? `Respuesta para ${this.response.tenant}`
        : "Preguntale al corpus",
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
      claims: this.response?.claims.map((claim, index) => ({
        number: String(index + 1).padStart(2, "0"),
        text: claim.text,
        citationIds: claim.citationIds,
      })) ?? [],
      sources: this.response?.sources.map((source) => this.sourceVM(source))
        ?? [],
    };
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
