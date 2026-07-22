import type { GroundedAnswerResponse } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { GroundingValidationError } from "../src/grounding/domain/grounding-validation-error.js";
import type {
  GroundedAnswerProgressEvent,
  GroundedAnswerGenerator,
} from "../src/grounding/ports/grounded-answer-generator.js";
import { createTestApp } from "./support/create-test-app.js";

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
} satisfies GroundedAnswerGenerator;

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
    const result = await request(createTestApp({ groundedAnswerGenerator: groundedAnswerService }))
      .post("/api/answer")
      .send(validRequest)
      .expect(200);

    expect(result.body).toEqual(response);
  });

  it("forbids disabling tenant isolation", async () => {
    const result = await request(createTestApp({ groundedAnswerGenerator: groundedAnswerService }))
      .post("/api/answer")
      .send({
        ...validRequest,
        config: { ...validRequest.config, tenantFilterEnabled: false },
      })
      .expect(400);

    expect(result.body.error.code).toBe("INVALID_GROUNDED_ANSWER_REQUEST");
  });

  it("does not expose provider failures to clients", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingGenerator: GroundedAnswerGenerator = {
      ...groundedAnswerService,
      answer: async () => {
        throw new Error("secret API key and upstream trace");
      },
    };

    const result = await request(createTestApp({
      groundedAnswerGenerator: failingGenerator,
    }))
      .post("/api/answer")
      .send(validRequest)
      .expect(503);

    expect(result.body).toEqual({
      error: {
        code: "GROUNDED_ANSWER_UNAVAILABLE",
        message: "Grounded answer generation is unavailable",
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("secret API key");
    consoleError.mockRestore();
  });

  it("maps invalid citations to a controlled gateway response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const invalidAnswer: GroundedAnswerGenerator = {
      ...groundedAnswerService,
      answer: async () => {
        throw new GroundingValidationError("Answer cites an unknown source");
      },
    };

    const result = await request(createTestApp({
      groundedAnswerGenerator: invalidAnswer,
    }))
      .post("/api/answer")
      .send(validRequest)
      .expect(502);

    expect(result.body.error).toEqual({
      code: "INVALID_GROUNDED_ANSWER",
      message: "Answer cites an unknown source",
    });
    consoleError.mockRestore();
  });
});
