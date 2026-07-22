import { RunRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import { RunNotFoundError } from "../../runs/application/run-not-found-error.js";
import type { RunLifecycle } from "../../runs/ports/run-lifecycle.js";
import { parseHttpRequest } from "../request-validation.js";
import type { SseRunConnection } from "../sse/sse-run-connection.js";
import type { SseRunConnectionFactory } from "../sse/sse-run-connection-factory.js";

export class RunsController {
  constructor(
    private readonly runs: RunLifecycle,
    private readonly connections: SseRunConnectionFactory,
  ) {}

  readonly create: RequestHandler = (request, response) => {
    const input = parseHttpRequest(RunRequestSchema, request.body, {
      code: "INVALID_RUN_REQUEST",
      message: "The run request is invalid",
    });
    response.status(202).json(this.runs.create(input));
  };

  readonly events: RequestHandler = (request, response, next) => {
    const afterEventId = this.readLastEventId(request.get("last-event-id"));
    const candidateRunId = request.params.runId;
    const runId = Array.isArray(candidateRunId)
      ? candidateRunId[0] ?? ""
      : candidateRunId ?? "";
    let connection: SseRunConnection | undefined;
    const subscription = this.runs.subscribe(
      runId,
      afterEventId,
      (event) => connection?.send(event),
    );

    if (!subscription) {
      next(new RunNotFoundError(runId));
      return;
    }

    connection = this.connections.create(request, response, subscription);
    connection.open();
  };

  private readLastEventId(header: string | undefined): number {
    const parsed = Number.parseInt(header ?? "0", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
