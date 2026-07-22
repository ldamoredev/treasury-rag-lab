import type { Request, Response } from "express";

import type { RunSubscription } from "../../runs/domain/RunSubscription.js";
import { SseRunConnection } from "./SseRunConnection.js";

export class SseRunConnectionFactory {
  create(
    request: Request,
    response: Response,
    subscription: RunSubscription,
  ): SseRunConnection {
    return new SseRunConnection(request, response, subscription);
  }
}
