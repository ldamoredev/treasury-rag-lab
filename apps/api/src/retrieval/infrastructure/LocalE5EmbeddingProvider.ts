import type { FeatureExtractionPipeline } from "@huggingface/transformers";

import { validateEmbeddingBatch } from "../domain/validateEmbeddingBatch.js";
import type { EmbeddingProvider } from "../ports/EmbeddingProvider.js";

type LocalE5EmbeddingProviderOptions = {
  model?: string;
  cacheDir: string;
};

type FeatureExtractionFactory = (
  task: "feature-extraction",
  model: string,
  options: { dtype: "q8"; device: "cpu" },
) => Promise<FeatureExtractionPipeline>;

export class LocalE5EmbeddingProvider implements EmbeddingProvider {
  readonly id = "transformers-js";
  readonly model: string;
  private extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

  constructor(private readonly options: LocalE5EmbeddingProviderOptions) {
    this.model = options.model ?? "Xenova/multilingual-e5-small";
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts.map((text) => `passage: ${text}`));
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embed([`query: ${text}`]);
    if (!embedding) {
      throw new Error("Embedding provider returned no query vector");
    }
    return embedding;
  }

  async dispose(): Promise<void> {
    if (this.extractorPromise) {
      await (await this.extractorPromise).dispose();
      this.extractorPromise = undefined;
    }
  }

  private async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const extractor = await this.getExtractor();
    const output = await extractor(texts, {
      pooling: "mean",
      normalize: true,
    });
    return validateEmbeddingBatch(output.tolist(), texts.length);
  }

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    this.extractorPromise ??= this.createExtractor();
    return this.extractorPromise;
  }

  private async createExtractor(): Promise<FeatureExtractionPipeline> {
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = this.options.cacheDir;
    env.allowRemoteModels = true;
    env.useFSCache = true;
    const createFeatureExtractor = pipeline as FeatureExtractionFactory;
    return createFeatureExtractor("feature-extraction", this.model, {
      dtype: "q8",
      device: "cpu",
    });
  }
}
