import { HealthResponseSchema } from "@treasury-rag/contracts";
import express from "express";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    const body = HealthResponseSchema.parse({
      status: "ok",
      service: "treasury-rag-api",
    });

    response.status(200).json(body);
  });

  return app;
}
