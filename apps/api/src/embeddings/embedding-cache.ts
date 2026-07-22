export type CachedEmbeddings = {
  dimensions: number | undefined;
  embeddings: Map<string, number[]>;
};

export interface EmbeddingCache {
  getMany(hashes: string[]): Promise<CachedEmbeddings>;
  setMany(entries: Map<string, number[]>, dimensions: number): Promise<void>;
}
