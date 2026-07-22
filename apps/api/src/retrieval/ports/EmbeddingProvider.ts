export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
