import type { ContextualizedChunk } from "@treasury-rag/contracts";

import type { TextHasher } from "../../retrieval/ports/TextHasher.js";
import type {
  ChunkContextualizer,
  ContextualizationInput,
} from "../ports/ChunkContextualizer.js";
import type { TokenCounter } from "../ports/TokenCounter.js";

/**
 * The pre-slice-8 behaviour, kept as an explicit object rather than a null
 * check: the chunk text is the embedding text. Its key is the hash of the raw
 * text, so vectors cached before contextual ingestion existed remain valid
 * and the baseline stays reproducible without re-embedding the corpus.
 */
export class PassthroughChunkContextualizer implements ChunkContextualizer {
  readonly id = "none";
  readonly model = "none";
  readonly promptVersion = "none";

  constructor(
    private readonly tokens: TokenCounter,
    private readonly hasher: TextHasher,
  ) {}

  async contextualize(
    input: ContextualizationInput,
  ): Promise<ContextualizedChunk[]> {
    return input.chunks.map((chunk) => ({
      ...chunk,
      contextualPrefix: "",
      embeddingText: chunk.text,
      embeddingKey: this.hasher.hash(chunk.text),
      tokenCount: this.tokens.count(chunk.text),
    }));
  }
}
