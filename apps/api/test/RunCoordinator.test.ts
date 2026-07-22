import type {
  GroundedAnswerRequest,
  GroundedAnswerResponse,
  RunEvent,
} from "@treasury-rag/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
  GroundedAnswerProgressEvent,
  GroundedAnswerGenerator,
} from "../src/grounding/ports/GroundedAnswerGenerator.js";
import { RunCoordinator } from "../src/runs/application/RunCoordinator.js";
import { RunExecutor } from "../src/runs/application/RunExecutor.js";
import { InMemoryRunRegistry } from "../src/runs/infrastructure/InMemoryRunRegistry.js";

const request: GroundedAnswerRequest = {
  query: "¿Qué ocurre con un pago parcial?",
  tenant: "acme",
  config: {
    chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true,
  },
};

const response: GroundedAnswerResponse = {
  query: request.query,
  tenant: request.tenant,
  answer: "La factura permanece abierta.",
  claims: [
    {
      text: "La factura permanece abierta.",
      citationIds: ["policy:1:characters:0:0-40"],
    },
  ],
  insufficientEvidence: false,
  sources: [
    {
      rank: 1,
      chunkId: "policy:1:characters:0:0-40",
      documentId: "policy",
      documentTitle: "Política",
      tenant: "global",
      version: 1,
      effectiveFrom: "2026-01-01",
      score: 0.92,
      text: "La factura permanece abierta.",
      startOffset: 0,
      endOffset: 40,
    },
  ],
  retrieval: {
    candidateChunks: 1,
    returnedChunks: 1,
    embeddingDimensions: 384,
    cacheHits: 1,
    cacheMisses: 0,
    durationMs: 3,
    provider: "fake-embeddings",
    model: "fake-e5",
  },
  generation: {
    attempted: true,
    durationMs: 8,
    provider: "fake-chat",
    model: "fake-model",
  },
};

const successfulService: GroundedAnswerGenerator = {
  answer: async () => response,
  async *streamAnswer(): AsyncGenerator<GroundedAnswerProgressEvent> {
    yield { type: "retrieval.started", query: request.query };
    yield {
      type: "retrieval.completed",
      sources: response.sources,
      stats: response.retrieval,
    };
    yield {
      type: "generation.started",
      provider: "fake-chat",
      model: "fake-model",
    };
    yield { type: "answer.delta", delta: "La factura " };
    yield { type: "answer.delta", delta: "permanece abierta." };
    yield { type: "answer.completed", response };
  },
};

function createCoordinator(
  generator: GroundedAnswerGenerator,
  completedRunTtlMs = 5 * 60_000,
) {
  const registry = new InMemoryRunRegistry(completedRunTtlMs);
  const executor = new RunExecutor(generator, registry);
  return new RunCoordinator(registry, executor);
}

async function collectRun(
  coordinator: RunCoordinator,
  runId: string,
): Promise<RunEvent[]> {
  return new Promise((resolve, reject) => {
    const events: RunEvent[] = [];
    const subscription = coordinator.subscribe(runId, 0, (event) => {
      events.push(event);
      if (event.type === "run.completed" || event.type === "run.failed") {
        resolve(events);
      }
    });

    if (!subscription) {
      reject(new Error("Run was not found"));
      return;
    }

    events.push(...subscription.events);
    if (subscription.terminal) {
      resolve(events);
    }
  });
}

describe("RunCoordinator", () => {
  it("emits the complete observable RAG lifecycle in order", async () => {
    const coordinator = createCoordinator(successfulService);
    const { runId } = coordinator.create(request);
    const events = await collectRun(coordinator, runId);

    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "retrieval.started",
      "retrieval.completed",
      "generation.started",
      "answer.delta",
      "answer.delta",
      "answer.completed",
      "evaluation.completed",
      "run.completed",
    ]);
    expect(events.map((event) => event.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(events.find((event) => event.type === "evaluation.completed")?.data)
      .toEqual({ citationValidity: true, tenantLeakage: false });
  });

  it("replays only events newer than Last-Event-ID", async () => {
    const coordinator = createCoordinator(successfulService);
    const { runId } = coordinator.create(request);
    await collectRun(coordinator, runId);

    const replay = coordinator.subscribe(runId, 6, () => undefined);

    expect(replay?.terminal).toBe(true);
    expect(replay?.events.map((event) => event.id)).toEqual([7, 8, 9]);
  });

  it("turns pipeline exceptions into a terminal run.failed event", async () => {
    const failingService: GroundedAnswerGenerator = {
      answer: async () => {
        throw new Error("provider unavailable");
      },
      async *streamAnswer(): AsyncGenerator<GroundedAnswerProgressEvent> {
        throw new Error("provider unavailable");
      },
    };
    const coordinator = createCoordinator(failingService);
    const { runId } = coordinator.create(request);
    const events = await collectRun(coordinator, runId);

    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "run.failed",
    ]);
    expect(events[1]?.data).toMatchObject({
      code: "RUN_FAILED",
      message: "The run failed",
    });
  });

  it("stops delivering events after a subscriber unsubscribes", async () => {
    const coordinator = createCoordinator(successfulService);
    const { runId } = coordinator.create(request);
    const received: RunEvent[] = [];
    const subscription = coordinator.subscribe(runId, 0, (event) => {
      received.push(event);
    });

    subscription?.unsubscribe();
    await collectRun(coordinator, runId);

    expect(received).toEqual([]);
  });

  it("removes a terminal run after its retention TTL", async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createCoordinator(successfulService, 50);
      const { runId } = coordinator.create(request);
      const completed = collectRun(coordinator, runId);

      await vi.runAllTicks();
      await completed;
      expect(coordinator.subscribe(runId, 0, () => undefined)).toBeDefined();

      await vi.advanceTimersByTimeAsync(50);

      expect(coordinator.subscribe(runId, 0, () => undefined)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
