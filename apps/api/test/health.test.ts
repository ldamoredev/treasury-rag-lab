import { HealthResponseSchema } from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns a response that satisfies the shared contract", async () => {
    const response = await request(createApp()).get("/health").expect(200);

    expect(HealthResponseSchema.parse(response.body)).toEqual({
      status: "ok",
      service: "treasury-rag-api",
    });
  });
});
