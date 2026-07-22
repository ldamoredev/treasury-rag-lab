import {
  ChunkPreviewRequestSchema,
  DocumentListResponseSchema,
  HealthResponseSchema,
  SearchRequestSchema,
} from "@treasury-rag/contracts";
import express from "express";

import { createChunkPreview } from "./chunking/preview.js";
import {
  documentRepository as productionDocumentRepository,
  type DocumentRepository,
} from "./documents/repository.js";
import { getProductionSearchService } from "./search/production-search-service.js";
import type { SearchService } from "./search/search-service.js";

export type AppDependencies = {
  documentRepository?: DocumentRepository;
  searchService?: SearchService;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const documentRepository =
    dependencies.documentRepository ?? productionDocumentRepository;
  const searchService =
    dependencies.searchService ?? getProductionSearchService(documentRepository);

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

  return app;
}
