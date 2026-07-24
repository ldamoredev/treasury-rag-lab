import type {
  EvalMetricStatus,
  ExperimentVariable,
  FailureLabComparisonResponse,
  FailureLabConfig,
  FailureLabExperiment,
  ResponsibleLayer,
} from "@treasury-rag/contracts";

import type { TreasuryRagGateway } from "../core/ports/TreasuryRagGateway";
import {
  errorMessage,
  isAbortError,
} from "./presentationFormat";

const VARIABLE_LABELS: Record<ExperimentVariable, string> = {
  chunkingStrategy: "Estrategia de chunking",
  chunkSize: "Chunk size",
  overlap: "Overlap",
  maxChunkSize: "Máximo por chunk",
  maxTokens: "Máximo de tokens",
  overlapTokens: "Overlap en tokens",
  topK: "Top-k",
  threshold: "Threshold",
  tenantFilter: "Filtro de tenant",
  latestVersionFilter: "Filtro de versión vigente",
  contextualIngestion: "Ingestión contextual",
};

const LAYER_LABELS: Record<ResponsibleLayer, string> = {
  chunking: "Chunking",
  retrieval: "Retrieval",
  filtering: "Filtering",
  generation: "Generación",
  evaluation: "Evaluación",
};

const STATUS_LABELS: Record<EvalMetricStatus, string> = {
  passed: "Pasa",
  failed: "Falla",
  notApplicable: "No aplica",
};

export type ConfigRowVM = {
  label: string;
  baseline: string;
  variant: string;
  changed: boolean;
};

export type FailureLabCaseChangeVM = {
  caseId: string;
  name: string;
  baselineStatus: string;
  variantStatus: string;
  detail: string;
};

export type FailureLabMetricRowVM = {
  metric: string;
  label: string;
  baselineRate: string;
  variantRate: string;
  delta: string;
  deltaTone: "good" | "bad" | "neutral";
};

export type FailureLabViewModel = {
  experimentOptions: { id: string; name: string }[];
  selectedExperimentId: string | undefined;
  selected: {
    name: string;
    description: string;
    variableLabel: string;
    learning: string;
    configRows: ConfigRowVM[];
  } | undefined;
  isLoadingList: boolean;
  isRunning: boolean;
  error: string | undefined;
  comparison: {
    experimentName: string;
    generatedAtLabel: string;
    metricRows: FailureLabMetricRowVM[];
    improvedCases: FailureLabCaseChangeVM[];
    degradedCases: FailureLabCaseChangeVM[];
    unchangedLabel: string;
    observedFailure: string;
    responsibleLayerLabel: string;
    suggestedFix: string;
  } | undefined;
};

export class FailureLabPresenter {
  private experiments: FailureLabExperiment[] = [];
  private selectedExperimentId: string | undefined;
  private comparison: FailureLabComparisonResponse | undefined;
  private isLoadingList = false;
  private isRunning = false;
  private error: string | undefined;
  private started = false;
  private session = 0;
  private request: AbortController | undefined;
  private currentModel: FailureLabViewModel;

  constructor(
    private readonly onChange: () => void,
    private readonly gateway: TreasuryRagGateway,
  ) {
    this.currentModel = this.buildModel();
  }

  get model(): FailureLabViewModel {
    return this.currentModel;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.session += 1;
    if (this.experiments.length === 0) {
      void this.loadExperiments(this.session);
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
    this.isLoadingList = false;
    this.isRunning = false;
    this.currentModel = this.buildModel();
  }

  selectExperiment(experimentId: string): void {
    if (this.selectedExperimentId !== experimentId) {
      this.selectedExperimentId = experimentId;
      this.comparison = undefined;
      this.error = undefined;
      this.refresh();
    }
  }

  async runComparison(): Promise<void> {
    const experimentId = this.selectedExperimentId;
    if (!this.started || !experimentId || this.isRunning) {
      return;
    }
    this.request?.abort();
    const request = new AbortController();
    const session = this.session;
    this.request = request;
    this.isRunning = true;
    this.error = undefined;
    this.refresh();

    try {
      const comparison = await this.gateway.compareFailureLabExperiment(
        { experimentId },
        { signal: request.signal },
      );
      if (this.isCurrent(session, request.signal)) {
        this.comparison = comparison;
      }
    } catch (error) {
      if (this.isCurrent(session, request.signal) && !isAbortError(error)) {
        this.error = errorMessage(error);
      }
    } finally {
      if (this.isCurrent(session, request.signal)) {
        this.isRunning = false;
        this.refresh();
      }
    }
  }

  private async loadExperiments(session: number): Promise<void> {
    const request = new AbortController();
    this.request = request;
    this.isLoadingList = true;
    this.error = undefined;
    this.refresh();

    try {
      const response = await this.gateway.listFailureLabExperiments({
        signal: request.signal,
      });
      if (this.isCurrent(session, request.signal)) {
        this.experiments = response.experiments;
        this.selectedExperimentId ??= response.experiments[0]?.id;
      }
    } catch (error) {
      if (this.isCurrent(session, request.signal) && !isAbortError(error)) {
        this.error = errorMessage(error);
      }
    } finally {
      if (this.isCurrent(session, request.signal)) {
        this.isLoadingList = false;
        this.refresh();
      }
    }
  }

  private isCurrent(session: number, signal: AbortSignal): boolean {
    return this.started && this.session === session && !signal.aborted;
  }

  private refresh(): void {
    this.currentModel = this.buildModel();
    this.onChange();
  }

  private buildModel(): FailureLabViewModel {
    const selected = this.experiments.find(
      (experiment) => experiment.id === this.selectedExperimentId,
    );
    const comparison = this.comparison;

    return {
      experimentOptions: this.experiments.map((experiment) => ({
        id: experiment.id,
        name: experiment.name,
      })),
      selectedExperimentId: this.selectedExperimentId,
      selected: selected
        ? {
            name: selected.name,
            description: selected.description,
            variableLabel: VARIABLE_LABELS[selected.variable],
            learning: selected.learning,
            configRows: buildConfigRows(selected),
          }
        : undefined,
      isLoadingList: this.isLoadingList,
      isRunning: this.isRunning,
      error: this.error,
      comparison: comparison
        ? {
            experimentName: comparison.experiment.name,
            generatedAtLabel: new Date(comparison.generatedAt)
              .toLocaleTimeString(),
            metricRows: comparison.metricDeltas.map((delta) => ({
              metric: delta.metric,
              label: delta.label,
              baselineRate: formatRate(delta.baseline.rate),
              variantRate: formatRate(delta.variant.rate),
              delta: formatDelta(delta.delta),
              deltaTone: delta.delta === null || delta.delta === 0
                ? "neutral" as const
                : delta.delta > 0
                  ? "good" as const
                  : "bad" as const,
            })),
            improvedCases: comparison.improvedCases.map(caseChangeVM),
            degradedCases: comparison.degradedCases.map(caseChangeVM),
            unchangedLabel: `${comparison.unchangedCases} caso(s) sin cambios`,
            observedFailure: comparison.observedFailure,
            responsibleLayerLabel: LAYER_LABELS[comparison.responsibleLayer],
            suggestedFix: comparison.suggestedFix,
          }
        : undefined,
    };
  }
}

function buildConfigRows(experiment: FailureLabExperiment): ConfigRowVM[] {
  const row = (
    label: string,
    read: (config: FailureLabConfig) => string,
    changed: boolean,
  ): ConfigRowVM => ({
    label,
    baseline: read(experiment.baseline),
    variant: read(experiment.variant),
    changed,
  });

  return [
    row("Chunking", describeChunking, experiment.variable === "chunkingStrategy"),
    row("Chunk size", (config) => readChunking(config, "chunkSize"), experiment.variable === "chunkSize"),
    row("Overlap", (config) => readChunking(config, "overlap"), experiment.variable === "overlap"),
    row("Top-k", (config) => String(config.topK), experiment.variable === "topK"),
    row("Threshold", (config) => config.threshold.toFixed(2), experiment.variable === "threshold"),
    row("Filtro de tenant", (config) => config.tenantFilterEnabled ? "on" : "off", experiment.variable === "tenantFilter"),
    row("Versión vigente", (config) => config.latestVersionOnly ? "on" : "off", experiment.variable === "latestVersionFilter"),
    row("Ingestión contextual", (config) => config.contextualIngestion ? "on" : "off", experiment.variable === "contextualIngestion"),
  ];
}

/** Each strategy has its own knobs; a row shows "—" where one does not apply. */
function describeChunking(config: FailureLabConfig): string {
  const chunking = config.chunking;
  switch (chunking.strategy) {
    case "characters":
      return `caracteres ${chunking.chunkSize}/${chunking.overlap}`;
    case "headings":
      return `headings ≤${chunking.maxChunkSize}`;
    case "tokens":
      return `tokens ${chunking.maxTokens}/${chunking.overlapTokens}`;
  }
}

function readChunking(
  config: FailureLabConfig,
  field: "chunkSize" | "overlap",
): string {
  const chunking = config.chunking;
  return chunking.strategy === "characters" ? String(chunking[field]) : "—";
}

function formatRate(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

function formatDelta(delta: number | null): string {
  if (delta === null) {
    return "—";
  }
  const percentage = Math.round(delta * 100);
  return percentage > 0 ? `+${percentage} pts` : `${percentage} pts`;
}

function caseChangeVM(change: FailureLabComparisonResponse["improvedCases"][number]): FailureLabCaseChangeVM {
  return {
    caseId: change.caseId,
    name: change.name,
    baselineStatus: STATUS_LABELS[change.baselineStatus],
    variantStatus: STATUS_LABELS[change.variantStatus],
    detail: change.detail,
  };
}
