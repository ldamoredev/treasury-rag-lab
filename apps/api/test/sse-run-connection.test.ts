import { EventEmitter } from "node:events";

import { RunEventSchema } from "@treasury-rag/contracts";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SseRunConnection } from "../src/http/sse/sse-run-connection.js";
import { RunSubscription } from "../src/runs/domain/run-subscription.js";

class FakeResponse {
  readonly writes: string[] = [];
  readonly headers: Record<string, string> = {};
  statusCode = 0;
  writableEnded = false;
  headersFlushed = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  set(headers: Record<string, string>) {
    Object.assign(this.headers, headers);
    return this;
  }

  flushHeaders() {
    this.headersFlushed = true;
  }

  write(value: string) {
    this.writes.push(value);
  }

  end() {
    this.writableEnded = true;
  }
}

afterEach(() => vi.useRealTimers());

describe("SseRunConnection", () => {
  it("writes replayed terminal events and closes the subscription once", () => {
    const request = new EventEmitter();
    const response = new FakeResponse();
    const unsubscribe = vi.fn();
    const terminalEvent = RunEventSchema.parse({
      id: 4,
      runId: "run-1",
      timestamp: "2026-07-22T12:00:00.000Z",
      type: "run.failed",
      data: { code: "FAILED", message: "Safe failure" },
    });
    const connection = new SseRunConnection(
      request as Request,
      response as unknown as Response,
      new RunSubscription([terminalEvent], true, unsubscribe),
    );

    connection.open();
    request.emit("close");

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toContain("text/event-stream");
    expect(response.writes[0]).toBe("retry: 2000\n\n");
    expect(response.writes.join("")).toContain("event: run.failed\n");
    expect(response.writableEnded).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("sends heartbeats until the browser disconnects", async () => {
    vi.useFakeTimers();
    const request = new EventEmitter();
    const response = new FakeResponse();
    const unsubscribe = vi.fn();
    const connection = new SseRunConnection(
      request as Request,
      response as unknown as Response,
      new RunSubscription([], false, unsubscribe),
    );

    connection.open();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(response.writes.join("")).toContain(": heartbeat ");

    const writesBeforeClose = response.writes.length;
    request.emit("close");
    await vi.advanceTimersByTimeAsync(15_000);

    expect(response.writes).toHaveLength(writesBeforeClose);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
