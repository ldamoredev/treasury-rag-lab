import {
  FailureLabComparisonResponseSchema,
  FailureLabExperimentListResponseSchema,
} from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { EvalRunner } from "../src/evals/application/EvalRunner.js";
import { treasuryEvalDataset } from "../src/evals/domain/treasuryEvalDataset.js";
import { ListFailureLabExperiments } from "../src/failureLab/application/ListFailureLabExperiments.js";
import { RunFailureLabComparison } from "../src/failureLab/application/RunFailureLabComparison.js";
import { FailureLabController } from "../src/http/controllers/FailureLabController.js";
import type { PolicySearch } from "../src/retrieval/ports/PolicySearch.js";
import { createTestApp } from "./support/createTestApp.js";

const emptySearch: PolicySearch = {
  search: async (request) => ({
    query: request.query,
    results: [],
    stats: {
      candidateChunks: 0,
      returnedChunks: 0,
      embeddingDimensions: 2,
      cacheHits: 0,
      cacheMisses: 0,
      durationMs: 1,
      provider: "fake",
      model: "fake-model",
      contextualizer: "none",
      tokenizer: "test",
    },
  }),
};

function failureLabWith(search: PolicySearch): FailureLabController {
  return new FailureLabController(
    new ListFailureLabExperiments(),
    new RunFailureLabComparison(
      new EvalRunner(search),
      treasuryEvalDataset,
      () => new Date("2026-07-22T12:00:00.000Z"),
    ),
  );
}

describe("failure lab API", () => {
  it("lists the predefined experiments with both configurations", async () => {
    const response = await request(createTestApp())
      .get("/api/failure-lab/experiments")
      .expect(200);
    const body = FailureLabExperimentListResponseSchema.parse(response.body);

    expect(body.experiments).toHaveLength(8);
    expect(body.experiments.map((experiment) => experiment.variable)).toEqual([
      "chunkSize",
      "overlap",
      "topK",
      "threshold",
      "tenantFilter",
      "latestVersionFilter",
      "contextualIngestion",
      "chunkingStrategy",
    ]);
    expect(body.experiments[0]?.baseline).toBeDefined();
    expect(body.experiments[0]?.variant).toBeDefined();
  });

  it("runs a comparison and returns a validated report", async () => {
    const app = createTestApp({ failureLab: failureLabWith(emptySearch) });

    const response = await request(app)
      .post("/api/failure-lab/compare")
      .send({ experimentId: "tenant-filter-on-vs-off" })
      .expect(200);
    const body = FailureLabComparisonResponseSchema.parse(response.body);

    expect(body.experiment.id).toBe("tenant-filter-on-vs-off");
    expect(body.mode).toBe("retrieval");
    expect(body.metricDeltas).toHaveLength(6);
    expect(body.generatedAt).toBe("2026-07-22T12:00:00.000Z");
  });

  it("returns a controlled 404 for an unknown experiment", async () => {
    const app = createTestApp({ failureLab: failureLabWith(emptySearch) });

    const response = await request(app)
      .post("/api/failure-lab/compare")
      .send({ experimentId: "unknown" })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "EXPERIMENT_NOT_FOUND",
        message: "Experiment unknown was not found",
      },
    });
  });

  it("validates the comparison request body", async () => {
    const app = createTestApp({ failureLab: failureLabWith(emptySearch) });

    const response = await request(app)
      .post("/api/failure-lab/compare")
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_FAILURE_LAB_REQUEST");
  });

  it("does not expose retrieval failures to clients", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingSearch: PolicySearch = {
      search: async () => {
        throw new Error("secret model path and provider details");
      },
    };
    const app = createTestApp({ failureLab: failureLabWith(failingSearch) });

    const response = await request(app)
      .post("/api/failure-lab/compare")
      .send({ experimentId: "tenant-filter-on-vs-off" })
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: "FAILURE_LAB_UNAVAILABLE",
        message: "The failure lab is unavailable",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("secret model path");
    consoleError.mockRestore();
  });
});
