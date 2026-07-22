import { RunEventSchema } from "@treasury-rag/contracts";
import { describe, expect, it, vi } from "vitest";

import { GroundedAnswerLabPresenter } from "../grounded-answer-lab-presenter";
import {
  FakeTreasuryRagGateway,
  searchResponse,
} from "./presenter-fixtures";

const completedResponse = {
  query: "pago parcial",
  tenant: "acme" as const,
  answer: "La factura permanece abierta.",
  claims: [],
  insufficientEvidence: true,
  sources: [],
  retrieval: searchResponse.stats,
  generation: {
    attempted: false as const,
    durationMs: 0 as const,
    provider: null,
    model: null,
  },
};

describe("GroundedAnswerLabPresenter", () => {
  it("turns ordered run events into trace, streaming text and final response", async () => {
    const gateway = new FakeTreasuryRagGateway();
    gateway.runEvents = [
      RunEventSchema.parse({
        id: 1,
        runId: "run-1",
        timestamp: "2026-07-22T12:00:00.000Z",
        type: "answer.delta",
        data: { delta: "La factura " },
      }),
      RunEventSchema.parse({
        id: 2,
        runId: "run-1",
        timestamp: "2026-07-22T12:00:01.000Z",
        type: "run.completed",
        data: { response: completedResponse },
      }),
    ];
    const presenter = new GroundedAnswerLabPresenter(vi.fn(), gateway);
    presenter.start();

    await presenter.submit();

    expect(presenter.model.trace.map((event) => event.type)).toEqual([
      "answer.delta",
      "run.completed",
    ]);
    expect(presenter.model.answer?.text).toBe("La factura permanece abierta.");
    expect(presenter.model.isLoading).toBe(false);
  });

  it("closes the run stream and aborts creation when stopped", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const close = vi.fn();
    gateway.stream = { close };
    const presenter = new GroundedAnswerLabPresenter(vi.fn(), gateway);
    presenter.start();
    await presenter.submit();
    expect(presenter.model.isLoading).toBe(true);

    presenter.stop();

    expect(close).toHaveBeenCalledTimes(1);
    expect(gateway.signals.at(-1)?.aborted).toBe(true);
    expect(presenter.model.isLoading).toBe(false);
  });
});
