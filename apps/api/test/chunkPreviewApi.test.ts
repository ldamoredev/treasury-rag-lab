import {
  ChunkPreviewResponseSchema,
  DocumentListResponseSchema,
} from "@treasury-rag/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "./support/createTestApp.js";

describe("chunk preview API", () => {
  it("lists document summaries without exposing full content", async () => {
    const response = await request(createTestApp())
      .get("/api/documents")
      .expect(200);
    const body = DocumentListResponseSchema.parse(response.body);

    expect(body.documents).toHaveLength(7);
    expect(body.documents.map((document) => document.tenant)).toEqual([
      "global",
      "global",
      "acme",
      "boreal",
      "acme",
      "boreal",
      "acme",
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

  it("reports token statistics alongside the character statistics", async () => {
    const response = await request(createTestApp())
      .post("/api/chunks/preview")
      .send({
        documentId: "partial-payments",
        config: { strategy: "tokens", maxTokens: 96, overlapTokens: 24 },
      })
      .expect(200);
    const body = ChunkPreviewResponseSchema.parse(response.body);

    expect(body.stats.documentTokens).toBeGreaterThan(0);
    expect(body.stats.maximumChunkTokens).toBeGreaterThan(0);
    expect(body.stats.averageChunkTokens).toBeGreaterThan(0);
    expect(body.contextualization.tokenizer).toBe("words");
  });

  it("exposes the contextual prefix separately from the citable text", async () => {
    const response = await request(createTestApp())
      .post("/api/chunks/preview")
      .send({
        documentId: "boreal-withholdings",
        config: { strategy: "characters", chunkSize: 300, overlap: 80 },
      })
      .expect(200);
    const body = ChunkPreviewResponseSchema.parse(response.body);

    expect(body.contextualization.enabled).toBe(true);
    for (const chunk of body.chunks) {
      expect(chunk.contextualPrefix).toContain("Retenciones impositivas");
      expect(chunk.text).not.toContain(chunk.contextualPrefix);
      expect(chunk.embeddingText).toBe(
        `${chunk.contextualPrefix}\n${chunk.text}`,
      );
    }
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
