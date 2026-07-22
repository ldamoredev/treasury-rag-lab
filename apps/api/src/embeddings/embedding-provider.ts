export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export function validateEmbeddingBatch(
  vectors: unknown,
  expectedCount: number,
): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) {
    throw new Error(
      `Embedding provider returned ${Array.isArray(vectors) ? vectors.length : "an invalid value"}; expected ${expectedCount}`,
    );
  }

  let dimensions: number | undefined;

  return vectors.map((candidate, index) => {
    if (
      !Array.isArray(candidate) ||
      candidate.length === 0 ||
      !candidate.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      throw new Error(`Embedding ${index} is not a finite numeric vector`);
    }

    dimensions ??= candidate.length;
    if (candidate.length !== dimensions) {
      throw new Error("Embedding provider returned inconsistent dimensions");
    }

    return candidate;
  });
}
