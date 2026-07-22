import { fileURLToPath } from "node:url";

import { createApp } from "../app.js";
import { PreviewDocumentChunks } from "../chunking/application/preview-document-chunks.js";
import { CharacterWindowChunker } from "../chunking/domain/character-window-chunker.js";
import { DocumentChunker } from "../chunking/domain/document-chunker.js";
import { MarkdownHeadingChunker } from "../chunking/domain/markdown-heading-chunker.js";
import { ListDocuments } from "../documents/application/list-documents.js";
import { FileDocumentRepository } from "../documents/infrastructure/file-document-repository.js";
import { GenerateGroundedAnswer } from "../grounding/application/generate-grounded-answer.js";
import { CitationValidator } from "../grounding/domain/citation-validator.js";
import { AnthropicChatProvider } from "../grounding/infrastructure/anthropic-chat-provider.js";
import { ChunkPreviewController } from "../http/controllers/chunk-preview-controller.js";
import { DocumentsController } from "../http/controllers/documents-controller.js";
import { GroundedAnswerController } from "../http/controllers/grounded-answer-controller.js";
import { HealthController } from "../http/controllers/health-controller.js";
import { RunsController } from "../http/controllers/runs-controller.js";
import { SemanticSearchController } from "../http/controllers/semantic-search-controller.js";
import { SseRunConnectionFactory } from "../http/sse/sse-run-connection-factory.js";
import { SemanticSearch } from "../retrieval/application/semantic-search.js";
import { JsonEmbeddingCache } from "../retrieval/infrastructure/json-embedding-cache.js";
import { LocalE5EmbeddingProvider } from "../retrieval/infrastructure/local-e5-embedding-provider.js";
import { Sha256TextHasher } from "../retrieval/infrastructure/sha256-text-hasher.js";
import { RunCoordinator } from "../runs/application/run-coordinator.js";
import { RunExecutor } from "../runs/application/run-executor.js";
import { InMemoryRunRegistry } from "../runs/infrastructure/in-memory-run-registry.js";

export function createProductionApp() {
  const documents = new FileDocumentRepository();
  const chunker = new DocumentChunker([
    new CharacterWindowChunker(),
    new MarkdownHeadingChunker(),
  ]);
  const embeddingProvider = new LocalE5EmbeddingProvider({
    model: process.env.EMBEDDING_MODEL ?? "Xenova/multilingual-e5-small",
    cacheDir: fileURLToPath(
      new URL("../../data/model-cache", import.meta.url),
    ),
  });
  const embeddingCache = new JsonEmbeddingCache({
    filePath: fileURLToPath(
      new URL("../../data/index/embeddings.json", import.meta.url),
    ),
    provider: embeddingProvider.id,
    model: embeddingProvider.model,
  });
  const search = new SemanticSearch(
    documents,
    chunker,
    embeddingProvider,
    embeddingCache,
    new Sha256TextHasher(),
  );
  const chat = new AnthropicChatProvider({
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
  });
  const answers = new GenerateGroundedAnswer(
    search,
    chat,
    new CitationValidator(),
  );
  const runRegistry = new InMemoryRunRegistry();
  const runExecutor = new RunExecutor(answers, runRegistry);
  const runs = new RunCoordinator(runRegistry, runExecutor);

  return createApp({
    health: new HealthController(),
    documents: new DocumentsController(new ListDocuments(documents)),
    chunkPreview: new ChunkPreviewController(
      new PreviewDocumentChunks(documents, chunker),
    ),
    semanticSearch: new SemanticSearchController(search),
    groundedAnswer: new GroundedAnswerController(answers),
    runs: new RunsController(runs, new SseRunConnectionFactory()),
  });
}
