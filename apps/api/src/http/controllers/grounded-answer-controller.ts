import { GroundedAnswerRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import { GroundedAnswerUnavailableError } from "../../grounding/application/grounded-answer-unavailable-error.js";
import { ProviderUnavailableError } from "../../grounding/application/provider-unavailable-error.js";
import { GroundingValidationError } from "../../grounding/domain/grounding-validation-error.js";
import type { GroundedAnswerGenerator } from "../../grounding/ports/grounded-answer-generator.js";
import { parseHttpRequest } from "../request-validation.js";

export class GroundedAnswerController {
  constructor(private readonly answers: GroundedAnswerGenerator) {}

  readonly handle: RequestHandler = async (request, response, next) => {
    const input = parseHttpRequest(GroundedAnswerRequestSchema, request.body, {
      code: "INVALID_GROUNDED_ANSWER_REQUEST",
      message: "The grounded answer request is invalid",
    });

    try {
      response.status(200).json(await this.answers.answer(input));
    } catch (error) {
      next(
        error instanceof GroundingValidationError
          || error instanceof ProviderUnavailableError
          ? error
          : new GroundedAnswerUnavailableError(error),
      );
    }
  };
}
