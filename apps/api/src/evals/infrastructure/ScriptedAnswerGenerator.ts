import {
  GroundedAnswerResponseSchema,
  type GroundedAnswerRequest,
  type GroundedAnswerResponse,
} from "@treasury-rag/contracts";

import type {
  GroundedAnswerGenerator,
  GroundedAnswerProgressEvent,
} from "../../grounding/ports/GroundedAnswerGenerator.js";
import type { PolicySearch } from "../../retrieval/ports/PolicySearch.js";

export type AnswerScript =
  | { kind: "abstain" }
  | { kind: "answer"; text: string };

const SCRIPTED_ABSTENTION =
  "No encontré evidencia suficiente en los documentos recuperados para responder esta pregunta.";

/**
 * Deterministic, cost-free answer executor for the offline eval suite. It
 * runs the same retrieval port as the real pipeline and then follows the
 * dataset script: abstain, or answer citing the top retrieved chunk. It
 * never calls a chat provider, so citation validity remains a real check
 * against the retrieved context.
 */
export class ScriptedAnswerGenerator implements GroundedAnswerGenerator {
  readonly id = "scripted";
  readonly model = "deterministic-fixture";

  constructor(
    private readonly search: PolicySearch,
    private readonly scripts: ReadonlyMap<string, AnswerScript>,
  ) {}

  async answer(
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse> {
    const searchResponse = await this.search.search(request);
    const script = this.scripts.get(request.query)
      ?? { kind: "abstain" as const };
    const topSource = searchResponse.results[0];

    if (script.kind === "abstain" || !topSource) {
      return GroundedAnswerResponseSchema.parse({
        query: request.query,
        tenant: request.tenant,
        answer: SCRIPTED_ABSTENTION,
        claims: [],
        insufficientEvidence: true,
        sources: [],
        retrieval: searchResponse.stats,
        generation: {
          attempted: false,
          durationMs: 0,
          provider: null,
          model: null,
        },
      });
    }

    return GroundedAnswerResponseSchema.parse({
      query: request.query,
      tenant: request.tenant,
      answer: script.text,
      claims: [{ text: script.text, citationIds: [topSource.chunkId] }],
      insufficientEvidence: false,
      sources: searchResponse.results,
      retrieval: searchResponse.stats,
      generation: {
        attempted: true,
        durationMs: 0,
        provider: this.id,
        model: this.model,
      },
    });
  }

  async *streamAnswer(
    request: GroundedAnswerRequest,
  ): AsyncGenerator<GroundedAnswerProgressEvent> {
    yield { type: "retrieval.started", query: request.query };
    const response = await this.answer(request);
    yield { type: "answer.completed", response };
  }
}
