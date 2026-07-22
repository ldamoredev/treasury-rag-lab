import type { GroundedAnswerResponse } from "@treasury-rag/contracts";

import { GroundingValidationError } from "../../grounding/domain/grounding-validation-error.js";
import type { GroundedAnswerGenerator } from "../../grounding/ports/grounded-answer-generator.js";
import { evaluateGrounding } from "../domain/evaluate-grounding.js";
import type { Run } from "../domain/run.js";
import type { RunRegistry } from "../ports/run-registry.js";

export class RunExecutor {
  constructor(
    private readonly answers: GroundedAnswerGenerator,
    private readonly runs: RunRegistry,
  ) {}

  async execute(run: Run): Promise<void> {
    const request = run.getRequest();
    run.emit("run.started", {
      query: request.query,
      tenant: request.tenant,
    });

    try {
      let completedResponse: GroundedAnswerResponse | undefined;
      for await (const progress of this.answers.streamAnswer(request)) {
        switch (progress.type) {
          case "retrieval.started":
            run.emit("retrieval.started", { query: progress.query });
            break;
          case "retrieval.completed":
            run.emit("retrieval.completed", {
              sources: progress.sources,
              stats: progress.stats,
            });
            break;
          case "generation.started":
            run.emit("generation.started", {
              provider: progress.provider,
              model: progress.model,
            });
            break;
          case "answer.delta":
            run.emit("answer.delta", { delta: progress.delta });
            break;
          case "answer.completed":
            completedResponse = progress.response;
            run.emit("answer.completed", {
              answer: progress.response.answer,
              claims: progress.response.claims,
              insufficientEvidence: progress.response.insufficientEvidence,
            });
            break;
        }
      }

      if (!completedResponse) {
        throw new Error("Run ended without a completed answer");
      }

      run.emit("evaluation.completed", evaluateGrounding(completedResponse));
      run.emit("run.completed", { response: completedResponse });
    } catch (error) {
      run.emit("run.failed", {
        code: error instanceof GroundingValidationError
          ? "INVALID_GROUNDED_ANSWER"
          : "RUN_FAILED",
        message: error instanceof GroundingValidationError
          ? error.message
          : "The run failed",
      });
    } finally {
      this.runs.retainTerminalRun(run.id);
    }
  }
}
