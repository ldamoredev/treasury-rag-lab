import type { GroundedAnswerRequest } from "@treasury-rag/contracts";
import { describe, expect, it, vi } from "vitest";

import { Run } from "../src/runs/domain/RunAggregate.js";

const request: GroundedAnswerRequest = {
  query: "¿Qué ocurre con un pago parcial?",
  tenant: "acme",
  config: {
    chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true,
    latestVersionOnly: true,
    contextualIngestion: false,
  },
};

describe("Run", () => {
  it("owns ordered event IDs and replays only events after a cursor", () => {
    const run = new Run(
      "run-1",
      request,
      () => new Date("2026-07-22T12:00:00.000Z"),
    );

    run.emit("run.started", { query: request.query, tenant: request.tenant });
    run.emit("retrieval.started", { query: request.query });

    const replay = run.subscribe(1, () => undefined);
    expect(replay.events.map((event) => event.id)).toEqual([2]);
    expect(replay.events[0]?.timestamp).toBe("2026-07-22T12:00:00.000Z");
  });

  it("marks itself terminal before publishing the final event", () => {
    const run = new Run("run-1", request);
    const terminalStateObserved = vi.fn();
    run.subscribe(0, () => terminalStateObserved(run.isTerminal()));

    run.emit("run.failed", { code: "FAILED", message: "Safe failure" });

    expect(terminalStateObserved).toHaveBeenCalledWith(true);
    expect(run.isTerminal()).toBe(true);
    expect(() => run.emit("retrieval.started", { query: request.query }))
      .toThrow(/terminal run/);
  });

  it("isolates a failing subscriber from the remaining subscribers", () => {
    const run = new Run("run-1", request);
    const healthySubscriber = vi.fn();
    run.subscribe(0, () => {
      throw new Error("disconnected");
    });
    run.subscribe(0, healthySubscriber);

    run.emit("retrieval.started", { query: request.query });
    run.emit("retrieval.started", { query: request.query });

    expect(healthySubscriber).toHaveBeenCalledTimes(2);
  });
});
