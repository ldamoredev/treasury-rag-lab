import type {
  RunCreatedResponse,
  RunEvent,
  RunRequest,
} from "@treasury-rag/contracts";

import type { RunSubscription } from "../domain/run-subscription.js";

export interface RunLifecycle {
  create(request: RunRequest): RunCreatedResponse;
  subscribe(
    runId: string,
    afterEventId: number,
    subscriber: (event: RunEvent) => void,
  ): RunSubscription | undefined;
}
