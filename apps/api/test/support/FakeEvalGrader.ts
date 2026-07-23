import type { EvalGrading } from "../../src/evals/domain/evalReport.js";
import type {
  EvalGrader,
  EvalGradingInput,
} from "../../src/evals/ports/EvalGrader.js";

export class FakeEvalGrader implements EvalGrader {
  readonly id = "fake-grader";
  readonly model = "fake-grader-model";
  readonly calls: EvalGradingInput[] = [];

  async grade(input: EvalGradingInput): Promise<EvalGrading> {
    this.calls.push(input);
    const origin = { provider: this.id, model: this.model } as const;

    return {
      faithfulness: {
        status: "graded",
        ...origin,
        score: 5,
        explanation: "Cada claim está soportado por sus citas.",
        claims: input.response.claims.map((claim) => ({
          claim: claim.text,
          faithful: true,
          explanation: "Claim soportado por la fuente citada.",
        })),
      },
      relevance: {
        status: "graded",
        ...origin,
        score: 4,
        explanation: "La respuesta contesta la pregunta directamente.",
      },
      correctness: {
        status: "graded",
        ...origin,
        score: 5,
        explanation: "Coincide con la respuesta de referencia.",
      },
    };
  }
}
