import type { Request, Response } from "express";

import type { RunSubscription } from "../../runs/domain/run-subscription.js";
import { SseRunConnection } from "./sse-run-connection.js";

export class SseRunConnectionFactory {
  create(
    request: Request,
    response: Response,
    subscription: RunSubscription,
  ): SseRunConnection {
    return new SseRunConnection(request, response, subscription);
  }
}
