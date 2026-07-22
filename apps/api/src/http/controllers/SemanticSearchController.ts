import { SearchRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import { SemanticSearchUnavailableError } from "../../retrieval/application/SemanticSearchUnavailableError.js";
import type { PolicySearch } from "../../retrieval/ports/PolicySearch.js";
import { parseHttpRequest } from "../requestValidation.js";

export class SemanticSearchController {
  constructor(private readonly search: PolicySearch) {}

  readonly handle: RequestHandler = async (request, response, next) => {
    const input = parseHttpRequest(SearchRequestSchema, request.body, {
      code: "INVALID_SEARCH_REQUEST",
      message: "The semantic search request is invalid",
    });

    try {
      response.status(200).json(await this.search.search(input));
    } catch (error) {
      next(new SemanticSearchUnavailableError(error));
    }
  };
}
