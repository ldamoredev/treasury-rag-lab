import type { EmbeddingProvider } from "../../src/retrieval/ports/embedding-provider.js";

type FakeEmbeddingProviderOptions = {
  documents: Record<string, number[]>;
  queries: Record<string, number[]>;
};

export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly id = "fake";
  readonly model = "fake-embeddings";
  documentCalls = 0;
  queryCalls = 0;

  constructor(private readonly vectors: FakeEmbeddingProviderOptions) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.documentCalls += 1;
    return texts.map((text) => this.find(this.vectors.documents, text));
  }

  async embedQuery(text: string): Promise<number[]> {
    this.queryCalls += 1;
    return this.find(this.vectors.queries, text);
  }

  private find(source: Record<string, number[]>, text: string): number[] {
    const vector = source[text];
    if (!vector) {
      throw new Error(`No fake embedding configured for: ${text}`);
    }
    return [...vector];
  }
}
