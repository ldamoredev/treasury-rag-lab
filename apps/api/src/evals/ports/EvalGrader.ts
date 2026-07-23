import type { GroundedAnswerResponse } from "@treasury-rag/contracts";

import type { EvalCase } from "../domain/evalCase.js";
import type { EvalGrading } from "../domain/evalReport.js";

export type EvalGradingInput = {
  evalCase: EvalCase;
  response: GroundedAnswerResponse;
};

/**
 * Optional model-based grader. Implementations may call a paid provider, so
 * wiring one in is always an explicit, opt-in decision. Graders produce a
 * signal (faithfulness per claim, answer relevance, correctness against the
 * reference answer), never an absolute truth.
 */
export interface EvalGrader {
  readonly id: string;
  readonly model: string;
  grade(input: EvalGradingInput): Promise<EvalGrading>;
}
