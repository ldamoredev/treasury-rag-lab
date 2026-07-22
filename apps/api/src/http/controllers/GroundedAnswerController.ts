import { GroundedAnswerRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import { GroundedAnswerUnavailableError } from "../../grounding/application/GroundedAnswerUnavailableError.js";
import { ProviderUnavailableError } from "../../grounding/application/ProviderUnavailableError.js";
import { GroundingValidationError } from "../../grounding/domain/GroundingValidationError.js";
import type { GroundedAnswerGenerator } from "../../grounding/ports/GroundedAnswerGenerator.js";
import { parseHttpRequest } from "../requestValidation.js";

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
