import type { EmbeddingProvider } from "../../src/retrieval/ports/EmbeddingProvider.js";

type FakeEmbeddingProviderOptions = {
  documents: Record<string, number[]>;
  queries: Record<string, number[]>;
  /**
   * Used when a text is not preconfigured. Tests that assert *what* was
   * embedded rather than *how it ranked* set this so they do not have to
   * spell out every contextual string the pipeline builds.
   */
  fallback?: number[];
};

export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly id = "fake";
  readonly model = "fake-embeddings";
  documentCalls = 0;
  queryCalls = 0;
  readonly embeddedDocuments: string[] = [];

  constructor(private readonly vectors: FakeEmbeddingProviderOptions) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.documentCalls += 1;
    this.embeddedDocuments.push(...texts);
    return texts.map((text) => this.find(this.vectors.documents, text));
  }

  async embedQuery(text: string): Promise<number[]> {
    this.queryCalls += 1;
    return this.find(this.vectors.queries, text);
  }

  private find(source: Record<string, number[]>, text: string): number[] {
    const vector = source[text] ?? this.vectors.fallback;
    if (!vector) {
      throw new Error(`No fake embedding configured for: ${text}`);
    }
    return [...vector];
  }
}
