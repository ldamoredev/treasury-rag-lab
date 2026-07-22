import type {
  ChunkPreviewResponse,
  ChunkingConfig,
  DocumentSummary,
} from "@treasury-rag/contracts";

import type { TreasuryRagGateway } from "../core/ports/TreasuryRagGateway";
import {
  errorMessage,
  isAbortError,
  tenantLabel,
} from "./presentationFormat";

type Strategy = ChunkingConfig["strategy"];

export type ChunkingDocumentVM = {
  id: string;
  title: string;
  tenant: string;
  version: string;
  effectiveFrom: string;
};

export type ChunkVM = {
  id: string;
  number: string;
  index: number;
  offsets: string;
  length: string;
  overlapText: string;
  remainingText: string;
  metadata: string;
};

export type ChunkingLabViewModel = {
  documents: ChunkingDocumentVM[];
  selectedDocumentId: string;
  selectedDocument: ChunkingDocumentVM | undefined;
  strategy: Strategy;
  chunkSize: number;
  overlap: number;
  maxChunkSize: number;
  overlapRangeMaximum: number;
  previewTitle: string;
  isLoading: boolean;
  documentsError: string | undefined;
  previewError: string | undefined;
  connectionLabel: string;
  connectionFailed: boolean;
  metrics: {
    chunks: number;
    documentCharacters: number;
    duplicatedCharacters: number;
    averageCharacters: number;
  } | undefined;
  chunks: ChunkVM[];
};

export class ChunkingLabPresenter {
  private documents: DocumentSummary[] = [];
  private selectedDocumentId = "";
  private strategy: Strategy = "characters";
  private chunkSize = 300;
  private overlap = 80;
  private maxChunkSize = 600;
  private preview: ChunkPreviewResponse | undefined;
  private documentsError: string | undefined;
  private previewError: string | undefined;
  private isLoading = false;
  private started = false;
  private session = 0;
  private documentRequest: AbortController | undefined;
  private previewRequest: AbortController | undefined;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private currentModel: ChunkingLabViewModel;

  constructor(
    private readonly onChange: () => void,
    private readonly gateway: TreasuryRagGateway,
    private readonly previewDelayMs = 120,
  ) {
    this.currentModel = this.buildModel();
  }

  get model(): ChunkingLabViewModel {
    return this.currentModel;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.session += 1;
    void this.loadDocuments(this.session);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.session += 1;
    this.clearPreviewTimer();
    this.documentRequest?.abort();
    this.previewRequest?.abort();
    this.documentRequest = undefined;
    this.previewRequest = undefined;
    this.isLoading = false;
    this.currentModel = this.buildModel();
  }

  selectDocument(documentId: string): void {
    if (this.selectedDocumentId === documentId) {
      return;
    }
    this.selectedDocumentId = documentId;
    this.refresh();
    this.schedulePreview();
  }

  setStrategy(strategy: Strategy): void {
    if (this.strategy === strategy) {
      return;
    }
    this.strategy = strategy;
    this.refresh();
    this.schedulePreview();
  }

  setChunkSize(value: number): void {
    const chunkSize = Math.max(1, Math.min(5_000, value));
    this.chunkSize = chunkSize;
    this.overlap = Math.min(this.overlap, chunkSize - 1);
    this.refresh();
    this.schedulePreview();
  }

  setOverlap(value: number): void {
    const overlap = Math.max(0, Math.min(this.chunkSize - 1, value));
    if (this.overlap === overlap) {
      return;
    }
    this.overlap = overlap;
    this.refresh();
    this.schedulePreview();
  }

  setMaxChunkSize(value: number): void {
    this.maxChunkSize = Math.max(1, Math.min(5_000, value));
    this.refresh();
    this.schedulePreview();
  }

  private async loadDocuments(session: number): Promise<void> {
    this.documentRequest?.abort();
    const request = new AbortController();
    this.documentRequest = request;
    this.documentsError = undefined;
    this.refresh();

    try {
      const response = await this.gateway.listDocuments({
        signal: request.signal,
      });
      if (!this.isCurrent(session, request.signal)) {
        return;
      }
      this.documents = response.documents;
      this.selectedDocumentId ||= response.documents[0]?.id ?? "";
      this.refresh();
      this.schedulePreview();
    } catch (error) {
      if (this.isCurrent(session, request.signal) && !isAbortError(error)) {
        this.documentsError = errorMessage(error);
        this.refresh();
      }
    }
  }

  private schedulePreview(): void {
    this.clearPreviewTimer();
    this.previewRequest?.abort();
    if (!this.started || !this.selectedDocumentId) {
      return;
    }

    const request = new AbortController();
    const session = this.session;
    this.previewRequest = request;
    this.isLoading = true;
    this.previewError = undefined;
    this.refresh();
    this.previewTimer = setTimeout(() => {
      void this.loadPreview(session, request);
    }, this.previewDelayMs);
  }

  private async loadPreview(
    session: number,
    request: AbortController,
  ): Promise<void> {
    try {
      const preview = await this.gateway.previewChunks(
        {
          documentId: this.selectedDocumentId,
          config: this.chunkingConfig(),
        },
        { signal: request.signal },
      );
      if (this.isCurrent(session, request.signal)) {
        this.preview = preview;
      }
    } catch (error) {
      if (this.isCurrent(session, request.signal) && !isAbortError(error)) {
        this.previewError = errorMessage(error);
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

  private clearPreviewTimer(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = undefined;
    }
  }

  private refresh(): void {
    this.currentModel = this.buildModel();
    this.onChange();
  }

  private buildModel(): ChunkingLabViewModel {
    const documents = this.documents.map((document) => this.documentVM(document));
    const selectedDocument = documents.find(
      (document) => document.id === this.selectedDocumentId,
    );

    return {
      documents,
      selectedDocumentId: this.selectedDocumentId,
      selectedDocument,
      strategy: this.strategy,
      chunkSize: this.chunkSize,
      overlap: this.overlap,
      maxChunkSize: this.maxChunkSize,
      overlapRangeMaximum: Math.min(300, this.chunkSize - 1),
      previewTitle: this.preview?.document.title ?? "Preparando documento…",
      isLoading: this.isLoading,
      documentsError: this.documentsError,
      previewError: this.previewError,
      connectionLabel: this.documentsError
        ? "API sin conexión"
        : this.documents.length > 0
          ? "API conectada"
          : "Conectando…",
      connectionFailed: this.documentsError !== undefined,
      metrics: this.preview
        ? {
            chunks: this.preview.stats.chunkCount,
            documentCharacters: this.preview.stats.documentCharacters,
            duplicatedCharacters: this.preview.stats.duplicatedCharacters,
            averageCharacters: Math.round(
              this.preview.stats.averageChunkCharacters,
            ),
          }
        : undefined,
      chunks: this.preview?.chunks.map((chunk, index, chunks) => {
        const overlapCharacters = index === 0
          ? 0
          : Math.max(0, chunks[index - 1]!.endOffset - chunk.startOffset);
        return {
          id: chunk.id,
          number: String(index + 1).padStart(2, "0"),
          index: chunk.index,
          offsets: `${chunk.startOffset}–${chunk.endOffset}`,
          length: `${chunk.text.length} chars`,
          overlapText: chunk.text.slice(0, overlapCharacters),
          remainingText: chunk.text.slice(overlapCharacters),
          metadata: `${tenantLabel(chunk.tenant)} · v${chunk.version}`,
        };
      }) ?? [],
    };
  }

  private documentVM(document: DocumentSummary): ChunkingDocumentVM {
    return {
      id: document.id,
      title: document.title,
      tenant: tenantLabel(document.tenant),
      version: `v${document.version}`,
      effectiveFrom: document.effectiveFrom,
    };
  }
}
