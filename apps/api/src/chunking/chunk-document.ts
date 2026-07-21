import type {
  Chunk,
  ChunkingConfig,
  Document,
} from "@treasury-rag/contracts";

import { chunkByCharacters } from "./chunk-by-characters.js";
import { chunkByHeadings } from "./chunk-by-headings.js";

export function chunkDocument(
  document: Document,
  config: ChunkingConfig,
): Chunk[] {
  switch (config.strategy) {
    case "characters":
      return chunkByCharacters(document, config);
    case "headings":
      return chunkByHeadings(document, config);
  }
}
