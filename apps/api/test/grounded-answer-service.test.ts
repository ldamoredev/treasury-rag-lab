import type {
  GroundedAnswerRequest,
  SearchResponse,
} from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import {
  createGroundedAnswerService,
  GroundingValidationError,
} from "../src/rag/grounded-answer-service.js";
import type { SearchService } from "../src/search/search-service.js";
import { FakeChatProvider } from "./support/fake-chat-provider.js";

const request: GroundedAnswerRequest = {
  query: "¿Un pago parcial cancela la factura?",
  tenant: "acme",
  config: {
    chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true,
  },
};

const searchResponse: SearchResponse = {
  query: request.query,
  results: [
    {
      rank: 1,
      chunkId: "global-policy:1:characters:0:0-46",
      documentId: "global-policy",
      documentTitle: "Política global de pagos",
      tenant: "global",
      version: 1,
      effectiveFrom: "2026-01-01",
      score: 0.92,
      text: "Un pago parcial no cancela la factura pendiente.",
      startOffset: 0,
      endOffset: 46,
    },
  ],
  stats: {
    candidateChunks: 2,
    returnedChunks: 1,
    embeddingDimensions: 384,
    cacheHits: 2,
    cacheMisses: 0,
    durationMs: 4,
    provider: "fake-embeddings",
    model: "fake-e5",
  },
};

function searchServiceFor(response: SearchResponse): SearchService {
  return { search: async () => response };
}

describe("grounded answer service", () => {
  it("retrieves evidence and returns only validated citations", async () => {
    const chatProvider = new FakeChatProvider({
      answer: "No. El saldo pendiente mantiene abierta la factura.",
      claims: [
        {
          text: "El pago parcial no cancela la factura.",
          citationIds: [searchResponse.results[0]!.chunkId],
        },
      ],
      insufficientEvidence: false,
    });
    const service = createGroundedAnswerService({
      searchService: searchServiceFor(searchResponse),
      chatProvider,
    });

    const response = await service.answer(request);

    expect(response.answer).toContain("mantiene abierta");
    expect(response.claims[0]?.citationIds).toEqual([
      searchResponse.results[0]!.chunkId,
    ]);
    expect(response.sources).toEqual(searchResponse.results);
    expect(response.generation).toMatchObject({
      attempted: true,
      provider: "fake-chat",
      model: "fake-grounded-model",
    });
    expect(chatProvider.calls).toHaveLength(1);
    expect(chatProvider.calls[0]?.tenant).toBe("acme");
  });

  it("abstains without spending a generation call when retrieval is empty", async () => {
    const chatProvider = new FakeChatProvider({
      answer: "This must never be returned",
      claims: [],
      insufficientEvidence: true,
    });
    const service = createGroundedAnswerService({
      searchService: searchServiceFor({
        ...searchResponse,
        results: [],
        stats: { ...searchResponse.stats, returnedChunks: 0 },
      }),
      chatProvider,
    });

    const response = await service.answer(request);

    expect(response.insufficientEvidence).toBe(true);
    expect(response.claims).toEqual([]);
    expect(response.generation).toEqual({
      attempted: false,
      durationMs: 0,
      provider: null,
      model: null,
    });
    expect(chatProvider.calls).toHaveLength(0);
  });

  it("rejects a citation ID that was not returned by retrieval", async () => {
    const chatProvider = new FakeChatProvider({
      answer: "Invented answer",
      claims: [
        { text: "Invented claim", citationIds: ["invented-source-id"] },
      ],
      insufficientEvidence: false,
    });
    const service = createGroundedAnswerService({
      searchService: searchServiceFor(searchResponse),
      chatProvider,
    });

    await expect(service.answer(request)).rejects.toBeInstanceOf(
      GroundingValidationError,
    );
  });

  it("rejects a source from another tenant even if retrieval returns it", async () => {
    const leakedSource = {
      ...searchResponse.results[0]!,
      chunkId: "boreal-policy:1:characters:0:0-46",
      documentId: "boreal-policy",
      tenant: "boreal" as const,
    };
    const chatProvider = new FakeChatProvider({
      answer: "Leaked answer",
      claims: [
        { text: "Leaked claim", citationIds: [leakedSource.chunkId] },
      ],
      insufficientEvidence: false,
    });
    const service = createGroundedAnswerService({
      searchService: searchServiceFor({
        ...searchResponse,
        results: [leakedSource],
      }),
      chatProvider,
    });

    await expect(service.answer(request)).rejects.toThrow(
      "from tenant boreal",
    );
  });
});
