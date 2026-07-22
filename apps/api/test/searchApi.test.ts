import type { SearchResponse } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { PolicySearch } from "../src/retrieval/ports/PolicySearch.js";
import { createTestApp } from "./support/createTestApp.js";

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
} satisfies PolicySearch;

describe("POST /api/search", () => {
  it("validates the request and returns the search response", async () => {
    const result = await request(createTestApp({ policySearch: searchService }))
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
    const result = await request(createTestApp({ policySearch: searchService }))
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

  it("does not expose provider failures to clients", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingSearch: PolicySearch = {
      search: async () => {
        throw new Error("secret model path and provider details");
      },
    };

    const result = await request(createTestApp({ policySearch: failingSearch }))
      .post("/api/search")
      .send({
        query: "pago parcial",
        tenant: "acme",
        config: {
          chunking: { strategy: "characters", chunkSize: 300, overlap: 80 },
          topK: 5,
          threshold: 0.7,
          tenantFilterEnabled: true,
        },
      })
      .expect(503);

    expect(result.body).toEqual({
      error: {
        code: "SEMANTIC_SEARCH_UNAVAILABLE",
        message: "Semantic search is unavailable",
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("secret model path");
    consoleError.mockRestore();
  });
});
