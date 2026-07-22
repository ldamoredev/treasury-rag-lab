import type { RunEvent } from "@treasury-rag/contracts";
import type { Request, Response } from "express";

import type { RunSubscription } from "../../runs/domain/run-subscription.js";
import {
  isTerminalRunEvent,
  serializeRunEvent,
} from "./run-event-serialization.js";

export class SseRunConnection {
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private closed = false;

  constructor(
    private readonly request: Request,
    private readonly response: Response,
    private readonly subscription: RunSubscription,
    private readonly heartbeatIntervalMs = 15_000,
  ) {}

  open(): void {
    this.response.status(200);
    this.response.set({
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    this.response.flushHeaders();
    this.response.write("retry: 2000\n\n");

    for (const event of this.subscription.events) {
      this.send(event);
    }

    if (this.closed) {
      return;
    }
    if (this.subscription.terminal) {
      this.close(true);
      return;
    }

    this.heartbeat = setInterval(() => {
      if (!this.response.writableEnded) {
        this.response.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, this.heartbeatIntervalMs);
    this.heartbeat.unref();
    this.request.on("close", this.handleDisconnect);
  }

  send = (event: RunEvent): void => {
    if (this.closed || this.response.writableEnded) {
      return;
    }

    this.response.write(serializeRunEvent(event));
    if (isTerminalRunEvent(event)) {
      this.close(true);
    }
  };

  private readonly handleDisconnect = () => {
    this.close(false);
  };

  private close(endResponse: boolean): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
    }
    this.subscription.unsubscribe();
    this.request.off("close", this.handleDisconnect);
    if (endResponse && !this.response.writableEnded) {
      this.response.end();
    }
  }
}
