import type {
  ChunkingConfig,
  SearchResponse,
  Tenant,
} from "@treasury-rag/contracts";

import type { TreasuryRagGateway } from "../core/ports/treasury-rag-gateway";
import {
  errorMessage,
  isAbortError,
} from "./presentation-format";

type Strategy = ChunkingConfig["strategy"];

export type SearchResultVM = {
  chunkId: string;
  rank: string;
  documentTitle: string;
  metadata: string;
  score: string;
  scoreWidth: string;
  text: string;
  offsets: string;
};

export type SemanticSearchLabViewModel = {
  query: string;
  tenant: Tenant;
  strategy: Strategy;
  chunkSize: number;
  overlap: number;
  maxChunkSize: number;
  topK: number;
  threshold: number;
  thresholdLabel: string;
  tenantFilterEnabled: boolean;
  isLoading: boolean;
  error: string | undefined;
  responseTitle: string;
  hasResponse: boolean;
  metrics: {
    candidates: number;
    results: number;
    cache: string;
    duration: number;
    provider: string;
    model: string;
    dimensions: string;
  } | undefined;
  results: SearchResultVM[];
};

export class SemanticSearchLabPresenter {
  private query = "¿Un pago parcial cancela la factura?";
  private tenant: Tenant = "acme";
  private strategy: Strategy = "characters";
  private chunkSize = 300;
  private overlap = 80;
  private maxChunkSize = 600;
  private topK = 5;
  private threshold = 0.7;
  private tenantFilterEnabled = true;
  private response: SearchResponse | undefined;
  private error: string | undefined;
  private isLoading = false;
  private started = false;
  private session = 0;
  private request: AbortController | undefined;
  private currentModel: SemanticSearchLabViewModel;

  constructor(
    private readonly onChange: () => void,
    private readonly gateway: TreasuryRagGateway,
  ) {
    this.currentModel = this.buildModel();
  }

  get model(): SemanticSearchLabViewModel {
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

  setStrategy(strategy: Strategy): void {
    this.strategy = strategy;
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

  setTenantFilterEnabled(enabled: boolean): void {
    this.tenantFilterEnabled = enabled;
    this.refresh();
  }

  async submit(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.request?.abort();
    const request = new AbortController();
    const session = this.session;
    this.request = request;
    this.isLoading = true;
    this.error = undefined;
    this.refresh();

    try {
      const response = await this.gateway.search(
        {
          query: this.query,
          tenant: this.tenant,
          config: {
            chunking: this.chunkingConfig(),
            topK: this.topK,
            threshold: this.threshold,
            tenantFilterEnabled: this.tenantFilterEnabled,
          },
        },
        { signal: request.signal },
      );
      if (this.isCurrent(session, request.signal)) {
        this.response = response;
      }
    } catch (error) {
      if (this.isCurrent(session, request.signal) && !isAbortError(error)) {
        this.error = errorMessage(error);
      }
    } finally {
      if (this.isCurrent(session, request.signal)) {
        this.isLoading = false;
        this.refresh();
      }
    }
  }

  private chunkingConfig(): ChunkingConfig {
    return this.strategy === "characters"
      ? {
          strategy: "characters",
          chunkSize: this.chunkSize,
          overlap: this.overlap,
        }
      : { strategy: "headings", maxChunkSize: this.maxChunkSize };
  }

  private isCurrent(session: number, signal: AbortSignal): boolean {
    return this.started && this.session === session && !signal.aborted;
  }

  private refresh(): void {
    this.currentModel = this.buildModel();
    this.onChange();
  }

  private buildModel(): SemanticSearchLabViewModel {
    return {
      query: this.query,
      tenant: this.tenant,
      strategy: this.strategy,
      chunkSize: this.chunkSize,
      overlap: this.overlap,
      maxChunkSize: this.maxChunkSize,
      topK: this.topK,
      threshold: this.threshold,
      thresholdLabel: this.threshold.toFixed(2),
      tenantFilterEnabled: this.tenantFilterEnabled,
      isLoading: this.isLoading,
      error: this.error,
      responseTitle: this.response
        ? `Resultados para “${this.response.query}”`
        : "Buscá evidencia en el corpus",
      hasResponse: this.response !== undefined,
      metrics: this.response
        ? {
            candidates: this.response.stats.candidateChunks,
            results: this.response.stats.returnedChunks,
            cache: `${this.response.stats.cacheHits}/${this.response.stats.cacheMisses}`,
            duration: Math.round(this.response.stats.durationMs),
            provider: this.response.stats.provider,
            model: this.response.stats.model,
            dimensions: `${this.response.stats.embeddingDimensions} dimensiones`,
          }
        : undefined,
      results: this.response?.results.map((result) => ({
        chunkId: result.chunkId,
        rank: `#${result.rank}`,
        documentTitle: result.documentTitle,
        metadata: `${result.tenant} · v${result.version} · ${result.effectiveFrom}`,
        score: result.score.toFixed(4),
        scoreWidth: `${Math.max(0, result.score) * 100}%`,
        text: result.text,
        offsets: `${result.startOffset}–${result.endOffset}`,
      })) ?? [],
    };
  }
}
