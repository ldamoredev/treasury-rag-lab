import { HealthResponseSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

export class HealthController {
  readonly handle: RequestHandler = (_request, response) => {
    response.status(200).json(HealthResponseSchema.parse({
      status: "ok",
      service: "treasury-rag-api",
    }));
  };
}
