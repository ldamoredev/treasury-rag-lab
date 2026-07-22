import type { SearchResponse } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { SearchService } from "../src/search/search-service.js";

const response: SearchResponse = {
  query: "pago parcial",
  results: [],
  stats: {
    candidateChunks: 3,
    returnedChunks: 0,
    embeddingDimensions: 384,
    cacheHits: 3,
    cacheMisses: 0,
    durationMs: 2,
    provider: "fake",
    model: "fake-model",
  },
};

const searchService = {
  search: async () => response,
} satisfies SearchService;

describe("POST /api/search", () => {
  it("validates the request and returns the search response", async () => {
    const result = await request(createApp({ searchService }))
      .post("/api/search")
      .send({
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
      })
      .expect(200);

    expect(result.body).toEqual(response);
  });

  it("rejects invalid thresholds before calling the service", async () => {
    const result = await request(createApp({ searchService }))
      .post("/api/search")
      .send({
        query: "pago parcial",
        tenant: "acme",
        config: {
          chunking: {
            strategy: "characters",
            chunkSize: 300,
            overlap: 80,
          },
          topK: 5,
          threshold: 2,
          tenantFilterEnabled: true,
        },
      })
      .expect(400);

    expect(result.body.error.code).toBe("INVALID_SEARCH_REQUEST");
  });
});
