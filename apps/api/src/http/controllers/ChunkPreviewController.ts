import { ChunkPreviewRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import type { PreviewDocumentChunks } from "../../chunking/application/PreviewDocumentChunks.js";
import { parseHttpRequest } from "../requestValidation.js";

export class ChunkPreviewController {
  constructor(private readonly previewChunks: PreviewDocumentChunks) {}

  readonly handle: RequestHandler = async (request, response, next) => {
    try {
      const input = parseHttpRequest(ChunkPreviewRequestSchema, request.body, {
        code: "INVALID_CHUNK_PREVIEW_REQUEST",
        message: "The chunk preview request is invalid",
      });
      response.status(200).json(await this.previewChunks.execute(input));
    } catch (error) {
      next(error);
    }
  };
}
