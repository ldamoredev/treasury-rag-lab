import {
  ChunkPreviewResponseSchema,
  DocumentListResponseSchema,
} from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "./support/create-test-app.js";

describe("chunk preview API", () => {
  it("lists document summaries without exposing full content", async () => {
    const response = await request(createTestApp())
      .get("/api/documents")
      .expect(200);
    const body = DocumentListResponseSchema.parse(response.body);

    expect(body.documents).toHaveLength(3);
    expect(body.documents.map((document) => document.tenant)).toEqual([
      "global",
      "acme",
      "boreal",
    ]);
    expect(response.body.documents[0]).not.toHaveProperty("content");
  });

  it("returns validated character chunks and observable statistics", async () => {
    const response = await request(createTestApp())
      .post("/api/chunks/preview")
      .send({
        documentId: "partial-payments",
        config: {
          strategy: "characters",
          chunkSize: 300,
          overlap: 80,
        },
      })
      .expect(200);
    const body = ChunkPreviewResponseSchema.parse(response.body);

    expect(body.chunks.length).toBeGreaterThan(1);
    expect(body.stats.duplicatedCharacters).toBeGreaterThan(0);
    expect(body.chunks[0]?.tenant).toBe("global");
  });

  it("rejects an invalid overlap", async () => {
    const response = await request(createTestApp())
      .post("/api/chunks/preview")
      .send({
        documentId: "partial-payments",
        config: {
          strategy: "characters",
          chunkSize: 300,
          overlap: 300,
        },
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_CHUNK_PREVIEW_REQUEST");
  });

  it("returns a stable error for an unknown document", async () => {
    const response = await request(createTestApp())
      .post("/api/chunks/preview")
      .send({
        documentId: "missing",
        config: {
          strategy: "headings",
          maxChunkSize: 900,
        },
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "DOCUMENT_NOT_FOUND",
        message: "Document missing was not found",
      },
    });
  });
});
