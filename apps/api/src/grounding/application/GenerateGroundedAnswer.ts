import {
  GroundedAnswerResponseSchema,
  type GroundedAnswer,
  type GroundedAnswerRequest,
  type GroundedAnswerResponse,
} from "@treasury-rag/contracts";

import type { PolicySearch } from "../../retrieval/ports/PolicySearch.js";
import type { CitationValidator } from "../domain/CitationValidator.js";
import type { ChatProvider } from "../ports/ChatProvider.js";
import type {
  GroundedAnswerGenerator,
  GroundedAnswerOptions,
  GroundedAnswerProgressEvent,
} from "../ports/GroundedAnswerGenerator.js";

const NO_EVIDENCE_ANSWER =
  "No encontré evidencia suficiente en los documentos recuperados para responder esta pregunta.";

export class GenerateGroundedAnswer implements GroundedAnswerGenerator {
  constructor(
    private readonly search: PolicySearch,
    private readonly chat: ChatProvider,
    private readonly citations: CitationValidator,
  ) {}

  async *streamAnswer(
    request: GroundedAnswerRequest,
    options: GroundedAnswerOptions = {},
  ): AsyncGenerator<GroundedAnswerProgressEvent> {
    yield { type: "retrieval.started", query: request.query };
    const searchResponse = await this.search.search(request);
    yield {
      type: "retrieval.completed",
      sources: searchResponse.results,
      stats: searchResponse.stats,
    };

    if (searchResponse.results.length === 0) {
      yield {
        type: "answer.completed",
        response: this.abstain(request, searchResponse.stats),
      };
      return;
    }

    yield {
      type: "generation.started",
      provider: this.chat.id,
      model: this.chat.model,
    };
    const generationStartedAt = performance.now();
    let groundedAnswer: GroundedAnswer | undefined;

    for await (const event of this.chat.streamGroundedAnswer(
      {
        query: request.query,
        tenant: request.tenant,
        sources: searchResponse.results,
      },
      options,
    )) {
      if (event.type === "answer.delta") {
        yield event;
      } else {
        groundedAnswer = event.answer;
      }
    }

    if (!groundedAnswer) {
      throw new Error("Chat provider stream ended without a grounded answer");
    }

    this.citations.validate(
      groundedAnswer,
      searchResponse.results,
      request.tenant,
    );

    yield {
      type: "answer.completed",
      response: GroundedAnswerResponseSchema.parse({
        ...groundedAnswer,
        query: request.query,
        tenant: request.tenant,
        sources: searchResponse.results,
        retrieval: searchResponse.stats,
        generation: {
          attempted: true,
          durationMs: performance.now() - generationStartedAt,
          provider: this.chat.id,
          model: this.chat.model,
        },
      }),
    };
  }

  async answer(
    request: GroundedAnswerRequest,
    options?: GroundedAnswerOptions,
  ): Promise<GroundedAnswerResponse> {
    let completed: GroundedAnswerResponse | undefined;
    for await (const event of this.streamAnswer(request, options)) {
      if (event.type === "answer.completed") {
        completed = event.response;
      }
    }

    if (!completed) {
      throw new Error("Grounded answer stream ended without a response");
    }
    return completed;
  }

  private abstain(
    request: GroundedAnswerRequest,
    retrieval: GroundedAnswerResponse["retrieval"],
  ): GroundedAnswerResponse {
    return GroundedAnswerResponseSchema.parse({
      query: request.query,
      tenant: request.tenant,
      answer: NO_EVIDENCE_ANSWER,
      claims: [],
      insufficientEvidence: true,
      sources: [],
      retrieval,
      generation: {
        attempted: false,
        durationMs: 0,
        provider: null,
        model: null,
      },
    });
  }
}
