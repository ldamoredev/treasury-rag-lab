import { FailureLabComparisonRequestSchema } from "@treasury-rag/contracts";
import type { RequestHandler } from "express";

import type { ListFailureLabExperiments } from "../../failureLab/application/ListFailureLabExperiments.js";
import type { RunFailureLabComparison } from "../../failureLab/application/RunFailureLabComparison.js";
import { ExperimentNotFoundError } from "../../failureLab/application/ExperimentNotFoundError.js";
import { FailureLabUnavailableError } from "../../failureLab/application/FailureLabUnavailableError.js";
import { InvalidExperimentConfigError } from "../../failureLab/domain/InvalidExperimentConfigError.js";
import { parseHttpRequest } from "../requestValidation.js";

export class FailureLabController {
  constructor(
    private readonly experiments: ListFailureLabExperiments,
    private readonly comparisons: RunFailureLabComparison,
  ) {}

  readonly list: RequestHandler = (_request, response) => {
    response.status(200).json(this.experiments.list());
  };

  readonly compare: RequestHandler = async (request, response, next) => {
    const input = parseHttpRequest(
      FailureLabComparisonRequestSchema,
      request.body,
      {
        code: "INVALID_FAILURE_LAB_REQUEST",
        message: "The failure lab comparison request is invalid",
      },
    );

    try {
      response.status(200).json(await this.comparisons.run(input.experimentId));
    } catch (error) {
      if (
        error instanceof ExperimentNotFoundError
        || error instanceof InvalidExperimentConfigError
      ) {
        next(error);
        return;
      }
      next(new FailureLabUnavailableError(error));
    }
  };
}
