import {
  CharacterChunkingConfigSchema,
  type CharacterChunkingConfig,
  type Chunk,
  type Document,
} from "@treasury-rag/contracts";

export function chunkByCharacters(
  document: Document,
  options: Omit<CharacterChunkingConfig, "strategy">,
): Chunk[] {
  const config = CharacterChunkingConfigSchema.parse({
    strategy: "characters",
    ...options,
  });

  if (document.content.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  const step = config.chunkSize - config.overlap;

  for (let startOffset = 0; startOffset < document.content.length; startOffset += step) {
    const endOffset = Math.min(
      startOffset + config.chunkSize,
      document.content.length,
    );

    chunks.push({
      id: `${document.id}:characters:${config.chunkSize}:${config.overlap}:${chunks.length}`,
      documentId: document.id,
      text: document.content.slice(startOffset, endOffset),
      index: chunks.length,
      tenant: document.tenant,
      version: document.version,
      effectiveFrom: document.effectiveFrom,
      startOffset,
      endOffset,
    });

    if (endOffset === document.content.length) {
      break;
    }
  }

  return chunks;
}
