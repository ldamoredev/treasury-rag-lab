import { RunEventSchema } from "@treasury-rag/contracts";
import { describe, expect, it, vi } from "vitest";

import { HttpTreasuryRagGateway } from "../http-treasury-rag-gateway";

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
});
