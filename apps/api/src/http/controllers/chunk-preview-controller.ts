import { ChunkPreviewRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import type { PreviewDocumentChunks } from "../../chunking/application/preview-document-chunks.js";
import { parseHttpRequest } from "../request-validation.js";

export class ChunkPreviewController {
  constructor(private readonly previewChunks: PreviewDocumentChunks) {}

  readonly handle: RequestHandler = (request, response) => {
    const input = parseHttpRequest(ChunkPreviewRequestSchema, request.body, {
      code: "INVALID_CHUNK_PREVIEW_REQUEST",
      message: "The chunk preview request is invalid",
    });
    response.status(200).json(this.previewChunks.execute(input));
  };
}
