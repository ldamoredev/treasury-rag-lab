import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { JsonEmbeddingCache } from "../src/retrieval/infrastructure/JsonEmbeddingCache.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createCache() {
  const directory = await mkdtemp(join(tmpdir(), "treasury-embeddings-"));
  temporaryDirectories.push(directory);
  const filePath = join(directory, "embeddings.json");
  const cache = new JsonEmbeddingCache({
    filePath,
    provider: "test-provider",
    model: "test-model",
  });
  return { cache, filePath };
}

describe("JsonEmbeddingCache", () => {
  it("writes inspectable embeddings and loads selected hashes", async () => {
    const { cache, filePath } = await createCache();

    await cache.setMany(new Map([["hash-a", [1, 0]]]), 2);

    const raw = JSON.parse(await readFile(filePath, "utf8"));
    expect(raw).toMatchObject({
      version: 1,
      provider: "test-provider",
      model: "test-model",
      dimensions: 2,
    });
    expect(raw.embeddings["hash-a"]).toEqual([1, 0]);

    const loaded = await cache.getMany(["hash-a", "missing"]);
    expect(loaded.dimensions).toBe(2);
    expect(loaded.embeddings.get("hash-a")).toEqual([1, 0]);
    expect(loaded.embeddings.has("missing")).toBe(false);
  });

  it("rejects inconsistent dimensions", async () => {
    const { cache } = await createCache();
    await cache.setMany(new Map([["hash-a", [1, 0]]]), 2);

    await expect(
      cache.setMany(new Map([["hash-b", [1, 0, 0]]]), 3),
    ).rejects.toThrow(/dimensions/);
  });
});
