import { RunEventSchema, type RunEvent } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { RunSubscription } from "../src/runs/domain/run-subscription.js";
import type { RunLifecycle } from "../src/runs/ports/run-lifecycle.js";
import { createTestApp } from "./support/create-test-app.js";

const runId = "run-test-123";
const completedEvent = RunEventSchema.parse({
  id: 1,
  runId,
  timestamp: "2026-07-22T12:00:00.000Z",
  type: "run.failed",
  data: { code: "TEST_FAILURE", message: "Observable failure" },
});

function fakeRunLifecycle(events: RunEvent[] = [completedEvent]): RunLifecycle {
  return {
    create: () => ({ runId }),
    subscribe: (requestedRunId, afterEventId) => requestedRunId === runId
      ? new RunSubscription(
          events.filter((event) => event.id > afterEventId),
          true,
          () => undefined,
        )
      : undefined,
  };
}

const validRequest = {
  query: "pago parcial",
  tenant: "acme",
  config: {
    chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true,
  },
};

describe("run SSE API", () => {
  it("creates a run asynchronously", async () => {
    const result = await request(createTestApp({ runs: fakeRunLifecycle() }))
      .post("/api/runs")
      .send(validRequest)
      .expect(202);

    expect(result.body).toEqual({ runId });
  });

  it("serializes typed events as an SSE stream", async () => {
    const result = await request(createTestApp({ runs: fakeRunLifecycle() }))
      .get(`/api/runs/${runId}/events`)
      .expect("content-type", /text\/event-stream/)
      .expect(200);

    expect(result.text).toContain("retry: 2000\n\n");
    expect(result.text).toContain("id: 1\n");
    expect(result.text).toContain("event: run.failed\n");
    expect(result.text).toContain(`data: ${JSON.stringify(completedEvent)}\n\n`);
  });

  it("returns 404 for an expired or unknown run", async () => {
    const result = await request(createTestApp({ runs: fakeRunLifecycle() }))
      .get("/api/runs/missing/events")
      .expect(404);

    expect(result.body.error.code).toBe("RUN_NOT_FOUND");
  });

  it("uses Last-Event-ID to request only missed events", async () => {
    const subscribe = vi.fn(fakeRunLifecycle().subscribe);
    const lifecycle: RunLifecycle = {
      create: () => ({ runId }),
      subscribe,
    };

    await request(createTestApp({ runs: lifecycle }))
      .get(`/api/runs/${runId}/events`)
      .set("Last-Event-ID", "7")
      .expect(200);

    expect(subscribe).toHaveBeenCalledWith(runId, 7, expect.any(Function));
  });
});
