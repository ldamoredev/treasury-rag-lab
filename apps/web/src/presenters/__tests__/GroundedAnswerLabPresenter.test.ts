import { RunEventSchema } from "@treasury-rag/contracts";
import { describe, expect, it, vi } from "vitest";

import { GroundedAnswerLabPresenter } from "../GroundedAnswerLabPresenter";
import {
  FakeTreasuryRagGateway,
  searchResponse,
} from "./presenterFixtures";

const retrievedSource = {
  rank: 1,
  chunkId: "partial-payments:characters:300:80:0",
  documentId: "partial-payments",
  documentTitle: "Política global",
  tenant: "global" as const,
  version: 2,
  effectiveFrom: "2026-01-15",
  score: 0.92,
  text: "Un pago parcial mantiene la factura abierta.",
  startOffset: 0,
  endOffset: 46,
};

const retrievalStats = {
  ...searchResponse.stats,
  candidateChunks: 4,
  returnedChunks: 1,
};

const completedResponse = {
  query: "pago parcial",
  tenant: "acme" as const,
  answer: "La factura permanece abierta.",
  claims: [{
    text: "La factura permanece abierta.",
    citationIds: [retrievedSource.chunkId],
  }],
  insufficientEvidence: false,
  sources: [retrievedSource],
  retrieval: retrievalStats,
  generation: {
    attempted: true as const,
    durationMs: 7,
    provider: "fake-chat",
    model: "fake-model",
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
        type: "run.started",
        data: { query: "pago parcial", tenant: "acme" },
      }),
      RunEventSchema.parse({
        id: 2,
        runId: "run-1",
        timestamp: "2026-07-22T12:00:01.000Z",
        type: "retrieval.completed",
        data: { sources: [retrievedSource], stats: retrievalStats },
      }),
      RunEventSchema.parse({
        id: 3,
        runId: "run-1",
        timestamp: "2026-07-22T12:00:02.000Z",
        type: "answer.delta",
        data: { delta: "La factura " },
      }),
      RunEventSchema.parse({
        id: 4,
        runId: "run-1",
        timestamp: "2026-07-22T12:00:03.000Z",
        type: "evaluation.completed",
        data: { citationValidity: true, tenantLeakage: false },
      }),
      RunEventSchema.parse({
        id: 5,
        runId: "run-1",
        timestamp: "2026-07-22T12:00:04.000Z",
        type: "run.completed",
        data: { response: completedResponse },
      }),
    ];
    const presenter = new GroundedAnswerLabPresenter(vi.fn(), gateway);
    presenter.start();

    await presenter.submit();

    expect(presenter.model.trace.map((event) => event.type)).toEqual([
      "run.started",
      "retrieval.completed",
      "answer.delta",
      "evaluation.completed",
      "run.completed",
    ]);
    expect(presenter.model.answer?.text).toBe("La factura permanece abierta.");
    expect(presenter.model.sources[0]?.chunkId).toBe(retrievedSource.chunkId);
    expect(presenter.model.evaluation).toEqual({
      citationValidity: true,
      tenantLeakage: false,
    });
    expect(presenter.model.inspectorTabs[0]?.badge).toBe("1");
    expect(presenter.model.isLoading).toBe(false);
  });

  it("owns inspector navigation and configurable run settings", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new GroundedAnswerLabPresenter(vi.fn(), gateway);
    presenter.start();

    expect(presenter.model.activeInspectorTab).toBe("retrieval");
    presenter.selectInspectorTab("settings");
    presenter.setTenant("boreal");
    presenter.setChunkingStrategy("headings");
    presenter.setMaxChunkSize(900);
    presenter.setTopK(8);
    presenter.setThreshold(0.4);
    presenter.setContextualIngestion(false);
    await presenter.submit();

    expect(presenter.model.activeInspectorTab).toBe("settings");
    expect(gateway.runCalls[0]).toEqual({
      query: "¿Un pago parcial cancela la factura?",
      tenant: "boreal",
      config: {
        chunking: { strategy: "headings", maxChunkSize: 900 },
        topK: 8,
        threshold: 0.4,
        tenantFilterEnabled: true,
        latestVersionOnly: true,
        contextualIngestion: false,
      },
    });
  });

  it("runs with contextual ingestion enabled by default", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new GroundedAnswerLabPresenter(vi.fn(), gateway);
    presenter.start();

    await presenter.submit();

    expect(gateway.runCalls[0]?.config.contextualIngestion).toBe(true);
    presenter.stop();
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
