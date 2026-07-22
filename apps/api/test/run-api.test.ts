import { RunEventSchema, type RunEvent } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { RunManager } from "../src/runs/run-manager.js";

const runId = "run-test-123";
const completedEvent = RunEventSchema.parse({
  id: 1,
  runId,
  timestamp: "2026-07-22T12:00:00.000Z",
  type: "run.failed",
  data: { code: "TEST_FAILURE", message: "Observable failure" },
});

function fakeRunManager(events: RunEvent[] = [completedEvent]): RunManager {
  return {
    create: () => ({ runId }),
    subscribe: (requestedRunId, afterEventId) => requestedRunId === runId
      ? {
          events: events.filter((event) => event.id > afterEventId),
          terminal: true,
          unsubscribe: () => undefined,
        }
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
    const result = await request(createApp({ runManager: fakeRunManager() }))
      .post("/api/runs")
      .send(validRequest)
      .expect(202);

    expect(result.body).toEqual({ runId });
  });

  it("serializes typed events as an SSE stream", async () => {
    const result = await request(createApp({ runManager: fakeRunManager() }))
      .get(`/api/runs/${runId}/events`)
      .expect("content-type", /text\/event-stream/)
      .expect(200);

    expect(result.text).toContain("retry: 2000\n\n");
    expect(result.text).toContain("id: 1\n");
    expect(result.text).toContain("event: run.failed\n");
    expect(result.text).toContain(`data: ${JSON.stringify(completedEvent)}\n\n`);
  });

  it("returns 404 for an expired or unknown run", async () => {
    const result = await request(createApp({ runManager: fakeRunManager() }))
      .get("/api/runs/missing/events")
      .expect(404);

    expect(result.body.error.code).toBe("RUN_NOT_FOUND");
  });
});
