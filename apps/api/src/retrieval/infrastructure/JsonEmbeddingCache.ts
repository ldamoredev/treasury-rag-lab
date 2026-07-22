import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { z } from "zod";

import type {
  CachedEmbeddings,
  EmbeddingCache,
} from "../ports/EmbeddingCache.js";

const CacheFileSchema = z.object({
  version: z.literal(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  dimensions: z.number().int().positive(),
  embeddings: z.record(z.string(), z.array(z.number().finite()).min(1)),
});

type CacheState = {
  dimensions: number | undefined;
  embeddings: Map<string, number[]>;
};

type JsonEmbeddingCacheOptions = {
  filePath: string;
  provider: string;
  model: string;
};

export class JsonEmbeddingCache implements EmbeddingCache {
  private statePromise: Promise<CacheState> | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: JsonEmbeddingCacheOptions) {}

  async getMany(hashes: string[]): Promise<CachedEmbeddings> {
    const state = await this.getState();
    const embeddings = new Map<string, number[]>();
    for (const hash of hashes) {
      const embedding = state.embeddings.get(hash);
      if (embedding) {
        embeddings.set(hash, [...embedding]);
      }
    }
    return { dimensions: state.dimensions, embeddings };
  }

  async setMany(
    entries: Map<string, number[]>,
    dimensions: number,
  ): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    this.writeQueue = this.writeQueue.then(async () => {
      const state = await this.getState();
      if (state.dimensions !== undefined && state.dimensions !== dimensions) {
        throw new Error(
          `Embedding cache dimensions ${state.dimensions} do not match ${dimensions}`,
        );
      }

      for (const [hash, embedding] of entries) {
        if (embedding.length !== dimensions) {
          throw new Error(`Embedding ${hash} has an unexpected dimension`);
        }
        state.embeddings.set(hash, [...embedding]);
      }
      state.dimensions = dimensions;
      await this.persist(state);
    });
    return this.writeQueue;
  }

  private getState(): Promise<CacheState> {
    this.statePromise ??= this.load();
    return this.statePromise;
  }

  private async load(): Promise<CacheState> {
    try {
      const raw = await readFile(this.options.filePath, "utf8");
      const parsed = CacheFileSchema.parse(JSON.parse(raw));
      if (
        parsed.provider !== this.options.provider
        || parsed.model !== this.options.model
      ) {
        throw new Error(
          `Embedding cache belongs to ${parsed.provider}/${parsed.model}, expected ${this.options.provider}/${this.options.model}`,
        );
      }

      for (const [hash, embedding] of Object.entries(parsed.embeddings)) {
        if (embedding.length !== parsed.dimensions) {
          throw new Error(
            `Cached embedding ${hash} has an unexpected dimension`,
          );
        }
      }
      return {
        dimensions: parsed.dimensions,
        embeddings: new Map(Object.entries(parsed.embeddings)),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { dimensions: undefined, embeddings: new Map() };
      }
      throw error;
    }
  }

  private async persist(state: CacheState): Promise<void> {
    if (state.dimensions === undefined) {
      return;
    }

    await mkdir(dirname(this.options.filePath), { recursive: true });
    const temporaryPath = `${this.options.filePath}.${process.pid}.tmp`;
    const body = JSON.stringify({
      version: 1,
      provider: this.options.provider,
      model: this.options.model,
      dimensions: state.dimensions,
      embeddings: Object.fromEntries(state.embeddings),
    });
    await writeFile(temporaryPath, body, "utf8");
    await rename(temporaryPath, this.options.filePath);
  }
}
