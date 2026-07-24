import type { TokenCounter } from "../../src/ingestion/ports/TokenCounter.js";

/**
 * Deterministic stand-in for the real tokenizer: one token per whitespace or
 * punctuation separated word. It never downloads a model, so chunking tests
 * stay fast and offline while still exercising token budgets rather than
 * character budgets.
 */
export class FakeTokenCounter implements TokenCounter {
  readonly id = "fake-token-counter";
  readonly model = "words";
  loadCalls = 0;

  async load(): Promise<void> {
    this.loadCalls += 1;
  }

  count(text: string): number {
    const matches = text.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu);
    return matches?.length ?? 0;
  }
}
