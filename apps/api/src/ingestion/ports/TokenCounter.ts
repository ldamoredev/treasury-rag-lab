/**
 * Counting is synchronous because chunking is a deterministic transformation
 * with no I/O. Loading the tokenizer is not: callers await `load()` once
 * before chunking, keeping the resource lifecycle explicit instead of hiding
 * a promise inside every count.
 */
export interface TokenCounter {
  readonly id: string;
  readonly model: string;
  load(): Promise<void>;
  count(text: string): number;
}
