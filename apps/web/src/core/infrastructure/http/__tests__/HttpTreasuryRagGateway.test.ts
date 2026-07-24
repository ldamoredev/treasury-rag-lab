import { RunEventSchema } from "@treasury-rag/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  HttpTreasuryRagGateway,
  TreasuryRagGatewayError,
} from "../HttpTreasuryRagGateway";

class FakeEventSource {
  readonly listeners = new Map<string, (event: Event) => void>();
  readyState = 1;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 2;
  });

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  emit(type: string, payload: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

const runRequest = {
  query: "pago parcial",
  tenant: "acme" as const,
  config: {
    chunking: { strategy: "characters" as const, chunkSize: 300, overlap: 80 },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true as const,
    latestVersionOnly: true,
    contextualIngestion: false,
  },
};

describe("HttpTreasuryRagGateway", () => {
  it("owns document HTTP transport and contract parsing", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      documents: [{
        id: "policy",
        title: "Policy",
        tenant: "global",
        version: 1,
        effectiveFrom: "2026-01-01",
      }],
    }), { status: 200 }));
    const gateway = new HttpTreasuryRagGateway({ fetcher });

    const result = await gateway.listDocuments();

    expect(result.documents[0]?.id).toBe("policy");
    expect(fetcher).toHaveBeenCalledWith("/api/documents", expect.objectContaining({ method: "GET" }));
  });

  it("creates a run, parses named SSE events and closes on terminal", async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ runId: "run-1" }),
      { status: 202 },
    ));
    const eventSource = new FakeEventSource();
    const gateway = new HttpTreasuryRagGateway({
      fetcher,
      eventSourceFactory: () => eventSource,
    });
    const onEvent = vi.fn();
    await gateway.startRun(runRequest, { onEvent, onError: vi.fn(), onReconnecting: vi.fn() });
    const event = RunEventSchema.parse({
      id: 1,
      runId: "run-1",
      timestamp: "2026-07-22T12:00:00.000Z",
      type: "run.failed",
      data: { code: "FAILED", message: "Safe failure" },
    });

    eventSource.emit("run.failed", event);

    expect(onEvent).toHaveBeenCalledWith(event);
    expect(eventSource.close).toHaveBeenCalledTimes(1);
    expect(eventSource.listeners.size).toBe(0);
  });

  it("lists and parses failure lab experiments", async () => {
    const experiment = {
      id: "tenant-filter-on-vs-off",
      name: "Tenant filter: on vs off",
      description: "Sin filtro hay fuga entre tenants.",
      variable: "tenantFilter",
      baseline: {
        chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
        topK: 5,
        threshold: 0.7,
        tenantFilterEnabled: true,
        latestVersionOnly: true,
        contextualIngestion: false,
      },
      variant: {
        chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
        topK: 5,
        threshold: 0.7,
        tenantFilterEnabled: false,
        latestVersionOnly: true,
        contextualIngestion: false,
      },
      responsibleLayer: "filtering",
      suggestedFix: "Reactivar el filtro.",
      learning: "La fuga ocurre en retrieval.",
    };
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ experiments: [experiment] }),
      { status: 200 },
    ));
    const gateway = new HttpTreasuryRagGateway({ fetcher });

    const result = await gateway.listFailureLabExperiments();

    expect(result.experiments[0]?.id).toBe("tenant-filter-on-vs-off");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/failure-lab/experiments",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("posts a failure lab comparison and parses the report", async () => {
    const comparison = {
      experiment: {
        id: "tenant-filter-on-vs-off",
        name: "Tenant filter: on vs off",
        description: "Sin filtro hay fuga entre tenants.",
        variable: "tenantFilter",
        baseline: {
          chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
          topK: 5,
          threshold: 0.7,
          tenantFilterEnabled: true,
          latestVersionOnly: true,
          contextualIngestion: false,
        },
        variant: {
          chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
          topK: 5,
          threshold: 0.7,
          tenantFilterEnabled: false,
          latestVersionOnly: true,
          contextualIngestion: false,
        },
        responsibleLayer: "filtering",
        suggestedFix: "Reactivar el filtro.",
        learning: "La fuga ocurre en retrieval.",
      },
      mode: "retrieval",
      generatedAt: "2026-07-22T12:00:00.000Z",
      metricDeltas: [{
        metric: "tenantLeakage",
        label: "Fuga entre tenants",
        baseline: { passed: 10, failed: 0, notApplicable: 0, rate: 1 },
        variant: { passed: 6, failed: 4, notApplicable: 0, rate: 0.6 },
        delta: -0.4,
      }],
      improvedCases: [],
      degradedCases: [{
        caseId: "acme-exclusive-rule",
        name: "Regla exclusiva de Acme",
        baselineStatus: "passed",
        variantStatus: "failed",
        detail: "tenantLeakage: passed → failed",
      }],
      unchangedCases: 9,
      observedFailure: "La variante degradó 1 caso(s).",
      responsibleLayer: "filtering",
      suggestedFix: "Reactivar el filtro.",
    };
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify(comparison),
      { status: 200 },
    ));
    const gateway = new HttpTreasuryRagGateway({ fetcher });

    const result = await gateway.compareFailureLabExperiment({
      experimentId: "tenant-filter-on-vs-off",
    });

    expect(result.degradedCases[0]?.caseId).toBe("acme-exclusive-rule");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/failure-lab/compare",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ experimentId: "tenant-filter-on-vs-off" }),
      }),
    );
  });

  it("rejects invalid failure lab payloads instead of trusting the server", async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ experiments: [{ id: 42 }] }),
      { status: 200 },
    ));
    const gateway = new HttpTreasuryRagGateway({ fetcher });

    await expect(gateway.listFailureLabExperiments()).rejects.toThrow();
  });

  it("propagates controlled API errors with their status", async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({
        error: {
          code: "EXPERIMENT_NOT_FOUND",
          message: "Experiment unknown was not found",
        },
      }),
      { status: 404 },
    ));
    const gateway = new HttpTreasuryRagGateway({ fetcher });

    const failure = await gateway
      .compareFailureLabExperiment({ experimentId: "unknown" })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(TreasuryRagGatewayError);
    expect((failure as TreasuryRagGatewayError).status).toBe(404);
    expect((failure as TreasuryRagGatewayError).message).toBe(
      "Experiment unknown was not found",
    );
  });
});
