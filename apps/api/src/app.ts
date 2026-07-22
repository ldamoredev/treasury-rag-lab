import {
  ChunkPreviewRequestSchema,
  DocumentListResponseSchema,
  GroundedAnswerRequestSchema,
  HealthResponseSchema,
  RunRequestSchema,
  SearchRequestSchema,
  type RunEvent,
} from "@treasury-rag/contracts";
import express from "express";

import { createChunkPreview } from "./chunking/preview.js";
import {
  documentRepository as productionDocumentRepository,
  type DocumentRepository,
} from "./documents/repository.js";
import { getProductionSearchService } from "./search/production-search-service.js";
import type { SearchService } from "./search/search-service.js";
import { getProductionGroundedAnswerService } from "./rag/production-grounded-answer-service.js";
import {
  GroundingValidationError,
  type GroundedAnswerService,
} from "./rag/grounded-answer-service.js";
import { getProductionRunManager } from "./runs/production-run-manager.js";
import type { RunManager, RunSubscription } from "./runs/run-manager.js";
import { isTerminalRunEvent, serializeRunEvent } from "./runs/sse.js";

export type AppDependencies = {
  documentRepository?: DocumentRepository;
  searchService?: SearchService;
  groundedAnswerService?: GroundedAnswerService;
  runManager?: RunManager;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const documentRepository =
    dependencies.documentRepository ?? productionDocumentRepository;
  const searchService =
    dependencies.searchService ?? getProductionSearchService(documentRepository);
  const groundedAnswerService = dependencies.groundedAnswerService
    ?? getProductionGroundedAnswerService(documentRepository);
  const runManager = dependencies.runManager
    ?? getProductionRunManager(documentRepository);

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    const body = HealthResponseSchema.parse({
      status: "ok",
      service: "treasury-rag-api",
    });

    response.status(200).json(body);
  });

  app.get("/api/documents", (_request, response) => {
    const body = DocumentListResponseSchema.parse({
      documents: documentRepository.list().map(({ content: _content, ...document }) =>
        document,
      ),
    });

    response.status(200).json(body);
  });

  app.post("/api/chunks/preview", (request, response) => {
    const parsedRequest = ChunkPreviewRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: {
          code: "INVALID_CHUNK_PREVIEW_REQUEST",
          message: "The chunk preview request is invalid",
          issues: parsedRequest.error.issues,
        },
      });
      return;
    }

    const document = documentRepository.findById(parsedRequest.data.documentId);

    if (!document) {
      response.status(404).json({
        error: {
          code: "DOCUMENT_NOT_FOUND",
          message: `Document ${parsedRequest.data.documentId} was not found`,
        },
      });
      return;
    }

    response
      .status(200)
      .json(createChunkPreview(document, parsedRequest.data.config));
  });

  app.post("/api/search", async (request, response) => {
    const parsedRequest = SearchRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: {
          code: "INVALID_SEARCH_REQUEST",
          message: "The semantic search request is invalid",
          issues: parsedRequest.error.issues,
        },
      });
      return;
    }

    try {
      response.status(200).json(await searchService.search(parsedRequest.data));
    } catch (error) {
      console.error("Semantic search failed", error);
      response.status(503).json({
        error: {
          code: "SEMANTIC_SEARCH_UNAVAILABLE",
          message:
            error instanceof Error
              ? error.message
              : "Semantic search is unavailable",
        },
      });
    }
  });

  app.post("/api/answer", async (request, response) => {
    const parsedRequest = GroundedAnswerRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: {
          code: "INVALID_GROUNDED_ANSWER_REQUEST",
          message: "The grounded answer request is invalid",
          issues: parsedRequest.error.issues,
        },
      });
      return;
    }

    try {
      response
        .status(200)
        .json(await groundedAnswerService.answer(parsedRequest.data));
    } catch (error) {
      console.error("Grounded answer generation failed", error);
      const invalidGrounding = error instanceof GroundingValidationError;
      response.status(invalidGrounding ? 502 : 503).json({
        error: {
          code: invalidGrounding
            ? "INVALID_GROUNDED_ANSWER"
            : "GROUNDED_ANSWER_UNAVAILABLE",
          message: error instanceof Error
            ? error.message
            : "Grounded answer generation is unavailable",
        },
      });
    }
  });

  app.post("/api/runs", (request, response) => {
    const parsedRequest = RunRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: {
          code: "INVALID_RUN_REQUEST",
          message: "The run request is invalid",
          issues: parsedRequest.error.issues,
        },
      });
      return;
    }

    response.status(202).json(runManager.create(parsedRequest.data));
  });

  app.get("/api/runs/:runId/events", (request, response) => {
    const lastEventId = Number.parseInt(request.get("last-event-id") ?? "0", 10);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let subscription: RunSubscription | undefined;
    let closed = false;

    function closeStream() {
      if (closed) {
        return;
      }

      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      subscription?.unsubscribe();
    }

    function sendEvent(event: RunEvent) {
      if (closed || response.writableEnded) {
        return;
      }

      response.write(serializeRunEvent(event));
      if (isTerminalRunEvent(event)) {
        closeStream();
        response.end();
      }
    }

    subscription = runManager.subscribe(
      request.params.runId,
      Number.isFinite(lastEventId) && lastEventId > 0 ? lastEventId : 0,
      sendEvent,
    );

    if (!subscription) {
      response.status(404).json({
        error: {
          code: "RUN_NOT_FOUND",
          message: `Run ${request.params.runId} was not found`,
        },
      });
      return;
    }

    response.status(200);
    response.set({
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    response.write("retry: 2000\n\n");

    for (const event of subscription.events) {
      sendEvent(event);
    }

    if (!closed && subscription.terminal) {
      closeStream();
      response.end();
      return;
    }

    if (!closed) {
      heartbeat = setInterval(() => {
        if (!response.writableEnded) {
          response.write(`: heartbeat ${Date.now()}\n\n`);
        }
      }, 15_000);
      heartbeat.unref();
    }

    request.on("close", closeStream);
  });

  return app;
}
