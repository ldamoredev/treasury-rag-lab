import type {
  CachedEmbeddings,
  EmbeddingCache,
} from "../../src/embeddings/embedding-cache.js";

export class MemoryEmbeddingCache implements EmbeddingCache {
  private readonly embeddings = new Map<string, number[]>();
  private dimensions: number | undefined;

  async getMany(hashes: string[]): Promise<CachedEmbeddings> {
    const selected = new Map<string, number[]>();
    for (const hash of hashes) {
      const embedding = this.embeddings.get(hash);
      if (embedding) {
        selected.set(hash, [...embedding]);
      }
    }
    return { dimensions: this.dimensions, embeddings: selected };
  }

  async setMany(entries: Map<string, number[]>, dimensions: number) {
    this.dimensions = dimensions;
    for (const [hash, embedding] of entries) {
      this.embeddings.set(hash, [...embedding]);
    }
  }
}
