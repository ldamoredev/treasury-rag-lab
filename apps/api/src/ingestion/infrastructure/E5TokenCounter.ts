import type { PreTrainedTokenizer } from "@huggingface/transformers";

import type { TokenCounter } from "../ports/TokenCounter.js";

type E5TokenCounterOptions = {
  model?: string;
  cacheDir: string;
};

/**
 * Counts tokens with the same tokenizer the embedding model uses, so a token
 * budget means the same thing during chunking and during embedding. The
 * tokenizer files ship with the cached model, so counting works offline and
 * never downloads anything the embedding provider has not already fetched.
 */
export class E5TokenCounter implements TokenCounter {
  readonly id = "transformers-js-tokenizer";
  readonly model: string;
  private tokenizerPromise: Promise<PreTrainedTokenizer> | undefined;
  private tokenizer: PreTrainedTokenizer | undefined;

  constructor(private readonly options: E5TokenCounterOptions) {
    this.model = options.model ?? "Xenova/multilingual-e5-small";
  }

  async load(): Promise<void> {
    this.tokenizerPromise ??= this.createTokenizer();
    this.tokenizer = await this.tokenizerPromise;
  }

  count(text: string): number {
    if (!this.tokenizer) {
      throw new Error("E5TokenCounter.load() must be awaited before counting");
    }
    if (text.length === 0) {
      return 0;
    }
    return this.tokenizer.encode(text, { add_special_tokens: false }).length;
  }

  private async createTokenizer(): Promise<PreTrainedTokenizer> {
    const { env, AutoTokenizer } = await import("@huggingface/transformers");
    env.cacheDir = this.options.cacheDir;
    env.useFSCache = true;
    return AutoTokenizer.from_pretrained(this.model);
  }
}
