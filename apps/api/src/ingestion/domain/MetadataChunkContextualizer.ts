import type {
  Chunk,
  ContextualizedChunk,
  Document,
} from "@treasury-rag/contracts";

import type { TextHasher } from "../../retrieval/ports/TextHasher.js";
import type {
  ChunkContextualizer,
  ContextualizationInput,
} from "../ports/ChunkContextualizer.js";
import type { TokenCounter } from "../ports/TokenCounter.js";
import { headingPathAt } from "./markdownStructure.js";

export const METADATA_CONTEXTUALIZER_PROMPT_VERSION = "2026-07-metadata-v2";

/**
 * Restores the provenance a chunk loses when it is cut: which document, which
 * version and which section it came from. Every part of the prefix is copied
 * from validated document metadata or from a heading that appears literally
 * in the source, so nothing is generated and nothing can be hallucinated into
 * the retrieval text.
 *
 * The prefix is deliberately *not* part of `text`. It steers the vector, and
 * that is all: a citation still quotes the document.
 *
 * The tenant is deliberately absent. It is already enforced deterministically
 * by document selection before anything is ranked, so repeating it in the
 * vector adds no reachability — it only adds lexical bias. Measured on this
 * dataset, including it dropped recall@k from 92% to 83%: a question naming
 * the tenant started preferring that tenant's chunks over the global rule
 * that actually answered it. Do not put in the embedding what a filter has
 * already decided.
 */
export class MetadataChunkContextualizer implements ChunkContextualizer {
  readonly id = "metadata-heading-path";
  readonly model = "deterministic";
  readonly promptVersion: string;

  constructor(
    private readonly tokens: TokenCounter,
    private readonly hasher: TextHasher,
    promptVersion: string = METADATA_CONTEXTUALIZER_PROMPT_VERSION,
  ) {
    this.promptVersion = promptVersion;
  }

  async contextualize(
    input: ContextualizationInput,
  ): Promise<ContextualizedChunk[]> {
    return input.chunks.map((chunk) => {
      const contextualPrefix = this.buildPrefix(input.document, chunk);
      const embeddingText = `${contextualPrefix}\n${chunk.text}`;

      return {
        ...chunk,
        contextualPrefix,
        embeddingText,
        embeddingKey: this.hasher.hash(
          `${this.id}|${this.model}|${this.promptVersion}|${embeddingText}`,
        ),
        tokenCount: this.tokens.count(embeddingText),
      };
    });
  }

  private buildPrefix(document: Document, chunk: Chunk): string {
    const headingPath = headingPathAt(document.content, chunk.startOffset);
    const parts = [
      `documento: ${document.title}`,
      `versión: v${document.version}`,
      `vigente desde: ${document.effectiveFrom}`,
    ];
    if (headingPath.length > 0) {
      parts.push(`sección: ${headingPath.join(" › ")}`);
    }
    return `[${parts.join(" · ")}]`;
  }
}
