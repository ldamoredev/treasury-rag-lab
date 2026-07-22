import { performance } from "node:perf_hooks";

import {
  GroundedAnswerResponseSchema,
  type GroundedAnswer,
  type GroundedAnswerRequest,
  type GroundedAnswerResponse,
  type SearchResult,
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
  answer(request: GroundedAnswerRequest): Promise<GroundedAnswerResponse>;
}

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
  return {
    async answer(request) {
      const searchResponse = await searchService.search(request);

      if (searchResponse.results.length === 0) {
        return GroundedAnswerResponseSchema.parse({
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
      }

      const generationStartedAt = performance.now();
      const groundedAnswer = await chatProvider.generateGroundedAnswer({
        query: request.query,
        tenant: request.tenant,
        sources: searchResponse.results,
      });
      const generationDurationMs = performance.now() - generationStartedAt;

      validateCitations(
        groundedAnswer,
        searchResponse.results,
        request.tenant,
      );

      return GroundedAnswerResponseSchema.parse({
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
    },
  };
}
