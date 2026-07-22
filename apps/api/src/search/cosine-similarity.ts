function assertVector(vector: number[], name: string): void {
  if (vector.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  if (!vector.every(Number.isFinite)) {
    throw new Error(`${name} must contain only finite numbers`);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  assertVector(a, "Vector a");
  assertVector(b, "Vector b");

  if (a.length !== b.length) {
    throw new Error("Vectors must have the same dimensions");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const valueA = a[index];
    const valueB = b[index];
    if (valueA === undefined || valueB === undefined) {
      throw new Error("Vector value is missing");
    }
    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error("Cosine similarity is undefined for zero vectors");
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}
