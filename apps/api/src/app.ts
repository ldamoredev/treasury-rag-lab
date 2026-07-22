import express from "express";

import type { ChunkPreviewController } from "./http/controllers/chunk-preview-controller.js";
import type { DocumentsController } from "./http/controllers/documents-controller.js";
import type { GroundedAnswerController } from "./http/controllers/grounded-answer-controller.js";
import type { HealthController } from "./http/controllers/health-controller.js";
import type { RunsController } from "./http/controllers/runs-controller.js";
import type { SemanticSearchController } from "./http/controllers/semantic-search-controller.js";
import { errorHandler } from "./http/errors/error-handler.js";

export type HttpControllers = {
  health: HealthController;
  documents: DocumentsController;
  chunkPreview: ChunkPreviewController;
  semanticSearch: SemanticSearchController;
  groundedAnswer: GroundedAnswerController;
  runs: RunsController;
};

export function createApp(controllers: HttpControllers) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", controllers.health.handle);
  app.get("/api/documents", controllers.documents.handle);
  app.post("/api/chunks/preview", controllers.chunkPreview.handle);
  app.post("/api/search", controllers.semanticSearch.handle);
  app.post("/api/answer", controllers.groundedAnswer.handle);
  app.post("/api/runs", controllers.runs.create);
  app.get("/api/runs/:runId/events", controllers.runs.events);

  app.use(errorHandler);
  return app;
}
