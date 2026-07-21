import {
  ChunkPreviewRequestSchema,
  DocumentListResponseSchema,
  HealthResponseSchema,
} from "@treasury-rag/contracts";
import express from "express";

import { createChunkPreview } from "./chunking/preview.js";
import { documentRepository } from "./documents/repository.js";

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

  return app;
}
