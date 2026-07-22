import { fileURLToPath } from "node:url";

import { JsonEmbeddingCache } from "../embeddings/json-embedding-cache.js";
import { LocalE5EmbeddingProvider } from "../embeddings/local-e5-embedding-provider.js";
import type { DocumentRepository } from "../documents/repository.js";
import { createSearchService, type SearchService } from "./search-service.js";

let singleton: SearchService | undefined;

export function getProductionSearchService(
  documentRepository: DocumentRepository,
): SearchService {
  if (singleton) {
    return singleton;
  }

  const model = process.env.EMBEDDING_MODEL ?? "Xenova/multilingual-e5-small";
  const provider = new LocalE5EmbeddingProvider({
    model,
    cacheDir: fileURLToPath(new URL("../../data/model-cache", import.meta.url)),
  });
  const embeddingCache = new JsonEmbeddingCache({
    filePath: fileURLToPath(
      new URL("../../data/index/embeddings.json", import.meta.url),
    ),
    provider: provider.id,
    model: provider.model,
  });

  singleton = createSearchService({
    documentRepository,
    embeddingProvider: provider,
    embeddingCache,
  });
  return singleton;
}
