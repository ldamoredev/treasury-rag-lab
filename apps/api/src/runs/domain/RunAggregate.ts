import {
  RunEventSchema,
  type RunEvent,
  type RunEventType,
  type RunRequest,
} from "@treasury-rag/contracts";

import { RunSubscription } from "./RunSubscription.js";

type RunEventData<Type extends RunEventType> = Extract<
  RunEvent,
  { type: Type }
>["data"];

type RunSubscriber = (event: RunEvent) => void;

export class Run {
  private readonly request: RunRequest;
  private readonly events: RunEvent[] = [];
  private readonly subscribers = new Set<RunSubscriber>();
  private nextEventId = 1;
  private terminal = false;

  constructor(
    readonly id: string,
    request: RunRequest,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.request = structuredClone(request);
  }

  getRequest(): RunRequest {
    return structuredClone(this.request);
  }

  isTerminal(): boolean {
    return this.terminal;
  }

  emit<Type extends RunEventType>(
    type: Type,
    data: RunEventData<Type>,
  ): RunEvent {
    if (this.terminal) {
      throw new Error(`Cannot emit ${type} for terminal run ${this.id}`);
    }

    const event = RunEventSchema.parse({
      id: this.nextEventId,
      runId: this.id,
      timestamp: this.now().toISOString(),
      type,
      data,
    });
    const isTerminal = type === "run.completed" || type === "run.failed";
    if (isTerminal) {
      this.terminal = true;
    }

    this.nextEventId += 1;
    this.events.push(structuredClone(event));
    this.publish(event);

    if (isTerminal) {
      this.subscribers.clear();
    }
    return structuredClone(event);
  }

  subscribe(
    afterEventId: number,
    subscriber: RunSubscriber,
  ): RunSubscription {
    const replay = this.events
      .filter((event) => event.id > afterEventId)
      .map((event) => structuredClone(event));

    if (!this.terminal) {
      this.subscribers.add(subscriber);
    }

    return new RunSubscription(replay, this.terminal, () => {
      this.subscribers.delete(subscriber);
    });
  }

  private publish(event: RunEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(structuredClone(event));
      } catch {
        this.subscribers.delete(subscriber);
      }
    }
  }
}
