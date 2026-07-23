import type {
  GroundedAnswerRequest,
  SearchResponse,
} from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { GenerateGroundedAnswer } from "../src/grounding/application/GenerateGroundedAnswer.js";
import { CitationValidator } from "../src/grounding/domain/CitationValidator.js";
import { GroundingValidationError } from "../src/grounding/domain/GroundingValidationError.js";
import type { PolicySearch } from "../src/retrieval/ports/PolicySearch.js";
import { FakeChatProvider } from "./support/FakeChatProvider.js";

const request: GroundedAnswerRequest = {
  query: "¿Un pago parcial cancela la factura?",
  tenant: "acme",
  config: {
    chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true,
    latestVersionOnly: true,
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

function searchServiceFor(response: SearchResponse): PolicySearch {
  return { search: async () => response };
}

describe("grounded answer service", () => {
  it("exposes retrieval, generation and answer deltas as progress events", async () => {
    const chatProvider = new FakeChatProvider({
      answer: "No. La factura permanece abierta.",
      claims: [
        {
          text: "La factura permanece abierta.",
          citationIds: [searchResponse.results[0]!.chunkId],
        },
      ],
      insufficientEvidence: false,
    });
    const service = new GenerateGroundedAnswer(
      searchServiceFor(searchResponse),
      chatProvider,
      new CitationValidator(),
    );
    const events = [];

    for await (const event of service.streamAnswer(request)) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "retrieval.started",
      "retrieval.completed",
      "generation.started",
      "answer.delta",
      "answer.completed",
    ]);
    expect(events.find((event) => event.type === "answer.delta")).toEqual({
      type: "answer.delta",
      delta: "No. La factura permanece abierta.",
    });
  });

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
    const service = new GenerateGroundedAnswer(
      searchServiceFor(searchResponse),
      chatProvider,
      new CitationValidator(),
    );

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
    const service = new GenerateGroundedAnswer(
      searchServiceFor({
        ...searchResponse,
        results: [],
        stats: { ...searchResponse.stats, returnedChunks: 0 },
      }),
      chatProvider,
      new CitationValidator(),
    );

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
    const service = new GenerateGroundedAnswer(
      searchServiceFor(searchResponse),
      chatProvider,
      new CitationValidator(),
    );

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
    const service = new GenerateGroundedAnswer(
      searchServiceFor({
        ...searchResponse,
        results: [leakedSource],
      }),
      chatProvider,
      new CitationValidator(),
    );

    await expect(service.answer(request)).rejects.toThrow(
      "from tenant boreal",
    );
  });
});
