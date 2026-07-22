import type { GroundedAnswerResponse } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type {
  GroundedAnswerProgressEvent,
  GroundedAnswerService,
} from "../src/rag/grounded-answer-service.js";

const response: GroundedAnswerResponse = {
  query: "pago parcial",
  tenant: "acme",
  answer: "El pago parcial mantiene la factura abierta.",
  claims: [
    {
      text: "La factura permanece abierta.",
      citationIds: ["policy:1:characters:0:0-50"],
    },
  ],
  insufficientEvidence: false,
  sources: [
    {
      rank: 1,
      chunkId: "policy:1:characters:0:0-50",
      documentId: "policy",
      documentTitle: "Política de pagos",
      tenant: "global",
      version: 1,
      effectiveFrom: "2026-01-01",
      score: 0.91,
      text: "El pago parcial mantiene la factura abierta.",
      startOffset: 0,
      endOffset: 50,
    },
  ],
  retrieval: {
    candidateChunks: 3,
    returnedChunks: 1,
    embeddingDimensions: 384,
    cacheHits: 3,
    cacheMisses: 0,
    durationMs: 2,
    provider: "fake",
    model: "fake-model",
  },
  generation: {
    attempted: true,
    durationMs: 5,
    provider: "fake-chat",
    model: "fake-claude",
  },
};

const groundedAnswerService = {
  answer: async () => response,
  async *streamAnswer(): AsyncGenerator<GroundedAnswerProgressEvent> {
    yield { type: "answer.completed", response };
  },
} satisfies GroundedAnswerService;

const validRequest = {
  query: "pago parcial",
  tenant: "acme",
  config: {
    chunking: {
      strategy: "characters",
      chunkSize: 300,
      overlap: 80,
    },
    topK: 5,
    threshold: 0.7,
    tenantFilterEnabled: true,
  },
};

describe("POST /api/answer", () => {
  it("validates the request and returns the grounded response", async () => {
    const result = await request(createApp({ groundedAnswerService }))
      .post("/api/answer")
      .send(validRequest)
      .expect(200);

    expect(result.body).toEqual(response);
  });

  it("forbids disabling tenant isolation", async () => {
    const result = await request(createApp({ groundedAnswerService }))
      .post("/api/answer")
      .send({
        ...validRequest,
        config: { ...validRequest.config, tenantFilterEnabled: false },
      })
      .expect(400);

    expect(result.body.error.code).toBe("INVALID_GROUNDED_ANSWER_REQUEST");
  });
});
