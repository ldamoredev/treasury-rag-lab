import { performance } from "node:perf_hooks";

import {
  GroundedAnswerResponseSchema,
  type GroundedAnswer,
  type GroundedAnswerRequest,
  type GroundedAnswerResponse,
  type SearchResult,
  type SearchStats,
} from "@treasury-rag/contracts";

import type { ChatProvider } from "../generation/chat-provider.js";
import type { SearchService } from "../search/search-service.js";

export class GroundingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundingValidationError";
  }
}

export interface GroundedAnswerService {
  answer(
    request: GroundedAnswerRequest,
    options?: GroundedAnswerStreamOptions,
  ): Promise<GroundedAnswerResponse>;
  streamAnswer(
    request: GroundedAnswerRequest,
    options?: GroundedAnswerStreamOptions,
  ): AsyncIterable<GroundedAnswerProgressEvent>;
}

export type GroundedAnswerStreamOptions = {
  signal?: AbortSignal;
};

export type GroundedAnswerProgressEvent =
  | { type: "retrieval.started"; query: string }
  | {
      type: "retrieval.completed";
      sources: SearchResult[];
      stats: SearchStats;
    }
  | { type: "generation.started"; provider: string; model: string }
  | { type: "answer.delta"; delta: string }
  | { type: "answer.completed"; response: GroundedAnswerResponse };

type GroundedAnswerServiceDependencies = {
  searchService: SearchService;
  chatProvider: ChatProvider;
};

const NO_EVIDENCE_ANSWER =
  "No encontré evidencia suficiente en los documentos recuperados para responder esta pregunta.";

function validateCitations(
  answer: GroundedAnswer,
  sources: SearchResult[],
  requestedTenant: GroundedAnswerRequest["tenant"],
): void {
  const sourcesById = new Map(
    sources.map((source) => [source.chunkId, source]),
  );

  for (const claim of answer.claims) {
    for (const citationId of claim.citationIds) {
      const source = sourcesById.get(citationId);
      if (!source) {
        throw new GroundingValidationError(
          `The generated answer cited an unknown source: ${citationId}`,
        );
      }

      if (source.tenant !== "global" && source.tenant !== requestedTenant) {
        throw new GroundingValidationError(
          `The generated answer cited source ${citationId} from tenant ${source.tenant}`,
        );
      }
    }
  }
}

export function createGroundedAnswerService({
  searchService,
  chatProvider,
}: GroundedAnswerServiceDependencies): GroundedAnswerService {
  async function* streamAnswer(
    request: GroundedAnswerRequest,
    options: GroundedAnswerStreamOptions = {},
  ): AsyncGenerator<GroundedAnswerProgressEvent> {
    yield { type: "retrieval.started", query: request.query };
    const searchResponse = await searchService.search(request);
    yield {
      type: "retrieval.completed",
      sources: searchResponse.results,
      stats: searchResponse.stats,
    };

    if (searchResponse.results.length === 0) {
      const response = GroundedAnswerResponseSchema.parse({
        query: request.query,
        tenant: request.tenant,
        answer: NO_EVIDENCE_ANSWER,
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
      yield { type: "answer.completed", response };
      return;
    }

    yield {
      type: "generation.started",
      provider: chatProvider.id,
      model: chatProvider.model,
    };
    const generationStartedAt = performance.now();
    let groundedAnswer: GroundedAnswer | undefined;

    for await (const event of chatProvider.streamGroundedAnswer(
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

    const generationDurationMs = performance.now() - generationStartedAt;
    validateCitations(
      groundedAnswer,
      searchResponse.results,
      request.tenant,
    );

    const response = GroundedAnswerResponseSchema.parse({
      ...groundedAnswer,
      query: request.query,
      tenant: request.tenant,
      sources: searchResponse.results,
      retrieval: searchResponse.stats,
      generation: {
        attempted: true,
        durationMs: generationDurationMs,
        provider: chatProvider.id,
        model: chatProvider.model,
      },
    });
    yield { type: "answer.completed", response };
  }

  return {
    streamAnswer,
    async answer(request, options) {
      let completedResponse: GroundedAnswerResponse | undefined;

      for await (const event of streamAnswer(request, options)) {
        if (event.type === "answer.completed") {
          completedResponse = event.response;
        }
      }

      if (!completedResponse) {
        throw new Error("Grounded answer stream ended without a response");
      }

      return completedResponse;
    },
  };
}
