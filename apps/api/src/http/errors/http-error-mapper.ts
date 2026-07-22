import { DocumentNotFoundError } from "../../documents/application/document-not-found-error.js";
import { GroundedAnswerUnavailableError } from "../../grounding/application/grounded-answer-unavailable-error.js";
import { ProviderUnavailableError } from "../../grounding/application/provider-unavailable-error.js";
import { GroundingValidationError } from "../../grounding/domain/grounding-validation-error.js";
import { SemanticSearchUnavailableError } from "../../retrieval/application/semantic-search-unavailable-error.js";
import { RunNotFoundError } from "../../runs/application/run-not-found-error.js";
import { InvalidHttpRequestError } from "./invalid-http-request-error.js";

type ErrorResponse = {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
      issues?: unknown[];
    };
  };
};

export function mapErrorToHttp(error: unknown): ErrorResponse {
  if (error instanceof InvalidHttpRequestError) {
    return {
      status: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
    };
  }
  if (error instanceof DocumentNotFoundError) {
    return {
      status: 404,
      body: { error: { code: "DOCUMENT_NOT_FOUND", message: error.message } },
    };
  }
  if (error instanceof RunNotFoundError) {
    return {
      status: 404,
      body: { error: { code: "RUN_NOT_FOUND", message: error.message } },
    };
  }
  if (error instanceof GroundingValidationError) {
    return {
      status: 502,
      body: {
        error: { code: "INVALID_GROUNDED_ANSWER", message: error.message },
      },
    };
  }
  if (error instanceof SemanticSearchUnavailableError) {
    return {
      status: 503,
      body: {
        error: {
          code: "SEMANTIC_SEARCH_UNAVAILABLE",
          message: error.message,
        },
      },
    };
  }
  if (
    error instanceof GroundedAnswerUnavailableError
    || error instanceof ProviderUnavailableError
  ) {
    return {
      status: 503,
      body: {
        error: {
          code: "GROUNDED_ANSWER_UNAVAILABLE",
          message: "Grounded answer generation is unavailable",
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
  };
}
