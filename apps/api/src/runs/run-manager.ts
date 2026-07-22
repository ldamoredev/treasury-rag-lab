import { randomUUID } from "node:crypto";

import {
  RunCreatedResponseSchema,
  RunEventSchema,
  type GroundedAnswerResponse,
  type RunCreatedResponse,
  type RunEvent,
  type RunEventType,
  type RunRequest,
} from "@treasury-rag/contracts";

import {
  GroundingValidationError,
  type GroundedAnswerService,
} from "../rag/grounded-answer-service.js";

type RunEventData<Type extends RunEventType> = Extract<
  RunEvent,
  { type: Type }
>["data"];

type RunSubscriber = (event: RunEvent) => void;

type RunRecord = {
  runId: string;
  request: RunRequest;
  events: RunEvent[];
  subscribers: Set<RunSubscriber>;
  terminal: boolean;
  nextEventId: number;
};

export type RunSubscription = {
  events: RunEvent[];
  terminal: boolean;
  unsubscribe(): void;
};

export interface RunManager {
  create(request: RunRequest): RunCreatedResponse;
  subscribe(
    runId: string,
    afterEventId: number,
    subscriber: RunSubscriber,
  ): RunSubscription | undefined;
}

type RunManagerOptions = {
  completedRunTtlMs?: number;
};

function evaluateGrounding(response: GroundedAnswerResponse) {
  const sourcesById = new Map(
    response.sources.map((source) => [source.chunkId, source]),
  );
  const citations = response.claims.flatMap((claim) => claim.citationIds);

  return {
    citationValidity: citations.every((citationId) =>
      sourcesById.has(citationId)
    ),
    tenantLeakage: response.sources.some(
      (source) =>
        source.tenant !== "global" && source.tenant !== response.tenant,
    ),
  };
}

export function createRunManager(
  groundedAnswerService: GroundedAnswerService,
  options: RunManagerOptions = {},
): RunManager {
  const runs = new Map<string, RunRecord>();
  const completedRunTtlMs = options.completedRunTtlMs ?? 5 * 60_000;

  function emit<Type extends RunEventType>(
    run: RunRecord,
    type: Type,
    data: RunEventData<Type>,
  ): RunEvent {
    const event = RunEventSchema.parse({
      id: run.nextEventId,
      runId: run.runId,
      timestamp: new Date().toISOString(),
      type,
      data,
    });
    run.nextEventId += 1;
    run.events.push(event);

    for (const subscriber of run.subscribers) {
      try {
        subscriber(event);
      } catch {
        run.subscribers.delete(subscriber);
      }
    }

    return event;
  }

  function scheduleCleanup(run: RunRecord) {
    const timeout = setTimeout(() => {
      runs.delete(run.runId);
      run.subscribers.clear();
    }, completedRunTtlMs);
    timeout.unref();
  }

  async function execute(run: RunRecord): Promise<void> {
    emit(run, "run.started", {
      query: run.request.query,
      tenant: run.request.tenant,
    });

    try {
      let completedResponse: GroundedAnswerResponse | undefined;

      for await (const progress of groundedAnswerService.streamAnswer(
        run.request,
      )) {
        switch (progress.type) {
          case "retrieval.started":
            emit(run, "retrieval.started", { query: progress.query });
            break;
          case "retrieval.completed":
            emit(run, "retrieval.completed", {
              sources: progress.sources,
              stats: progress.stats,
            });
            break;
          case "generation.started":
            emit(run, "generation.started", {
              provider: progress.provider,
              model: progress.model,
            });
            break;
          case "answer.delta":
            emit(run, "answer.delta", { delta: progress.delta });
            break;
          case "answer.completed":
            completedResponse = progress.response;
            emit(run, "answer.completed", {
              answer: progress.response.answer,
              claims: progress.response.claims,
              insufficientEvidence: progress.response.insufficientEvidence,
            });
            break;
        }
      }

      if (!completedResponse) {
        throw new Error("Run ended without a completed answer");
      }

      emit(run, "evaluation.completed", evaluateGrounding(completedResponse));
      run.terminal = true;
      emit(run, "run.completed", { response: completedResponse });
      run.subscribers.clear();
    } catch (error) {
      run.terminal = true;
      emit(run, "run.failed", {
        code: error instanceof GroundingValidationError
          ? "INVALID_GROUNDED_ANSWER"
          : "RUN_FAILED",
        message: error instanceof Error ? error.message : "The run failed",
      });
      run.subscribers.clear();
    } finally {
      scheduleCleanup(run);
    }
  }

  return {
    create(request) {
      const runId = `run-${randomUUID()}`;
      const run: RunRecord = {
        runId,
        request,
        events: [],
        subscribers: new Set(),
        terminal: false,
        nextEventId: 1,
      };
      runs.set(runId, run);
      queueMicrotask(() => void execute(run));
      return RunCreatedResponseSchema.parse({ runId });
    },

    subscribe(runId, afterEventId, subscriber) {
      const run = runs.get(runId);
      if (!run) {
        return undefined;
      }

      const events = run.events.filter((event) => event.id > afterEventId);
      if (!run.terminal) {
        run.subscribers.add(subscriber);
      }

      return {
        events,
        terminal: run.terminal,
        unsubscribe() {
          run.subscribers.delete(subscriber);
        },
      };
    },
  };
}
