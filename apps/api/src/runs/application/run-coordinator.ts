import {
  RunCreatedResponseSchema,
  type RunCreatedResponse,
  type RunRequest,
} from "@treasury-rag/contracts";

import { Run } from "../domain/run.js";
import type { RunSubscription } from "../domain/run-subscription.js";
import type { RunRegistry } from "../ports/run-registry.js";
import type { RunLifecycle } from "../ports/run-lifecycle.js";
import type { RunExecutor } from "./run-executor.js";

type RunSubscriber = Parameters<Run["subscribe"]>[1];

export class RunCoordinator implements RunLifecycle {
  constructor(
    private readonly runs: RunRegistry,
    private readonly executor: RunExecutor,
    private readonly createId: () => string = () =>
      `run-${globalThis.crypto.randomUUID()}`,
  ) {}

  create(request: RunRequest): RunCreatedResponse {
    const run = new Run(this.createId(), request);
    this.runs.save(run);
    queueMicrotask(() => void this.executor.execute(run));
    return RunCreatedResponseSchema.parse({ runId: run.id });
  }

  subscribe(
    runId: string,
    afterEventId: number,
    subscriber: RunSubscriber,
  ): RunSubscription | undefined {
    return this.runs.find(runId)?.subscribe(afterEventId, subscriber);
  }
}
