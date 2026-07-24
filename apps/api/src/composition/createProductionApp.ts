import { fileURLToPath } from "node:url";

import { createApp } from "../app.js";
import { PreviewDocumentChunks } from "../chunking/application/PreviewDocumentChunks.js";
import { CharacterWindowChunker } from "../chunking/domain/CharacterWindowChunker.js";
import { DocumentChunker } from "../chunking/domain/DocumentChunker.js";
import { MarkdownHeadingChunker } from "../chunking/domain/MarkdownHeadingChunker.js";
import { TokenWindowChunker } from "../chunking/domain/TokenWindowChunker.js";
import { ListDocuments } from "../documents/application/ListDocuments.js";
import { FileDocumentRepository } from "../documents/infrastructure/FileDocumentRepository.js";
import { EvalRunner } from "../evals/application/EvalRunner.js";
import { treasuryEvalDataset } from "../evals/domain/treasuryEvalDataset.js";
import { ListFailureLabExperiments } from "../failureLab/application/ListFailureLabExperiments.js";
import { RunFailureLabComparison } from "../failureLab/application/RunFailureLabComparison.js";
import { GenerateGroundedAnswer } from "../grounding/application/GenerateGroundedAnswer.js";
import { CitationValidator } from "../grounding/domain/CitationValidator.js";
import { AnthropicChatProvider } from "../grounding/infrastructure/AnthropicChatProvider.js";
import { ChunkPreviewController } from "../http/controllers/ChunkPreviewController.js";
import { DocumentsController } from "../http/controllers/DocumentsController.js";
import { FailureLabController } from "../http/controllers/FailureLabController.js";
import { GroundedAnswerController } from "../http/controllers/GroundedAnswerController.js";
import { HealthController } from "../http/controllers/HealthController.js";
import { RunsController } from "../http/controllers/RunsController.js";
import { SemanticSearchController } from "../http/controllers/SemanticSearchController.js";
import { SseRunConnectionFactory } from "../http/sse/SseRunConnectionFactory.js";
import { DocumentIngestionPipeline } from "../ingestion/application/DocumentIngestionPipeline.js";
import { MetadataChunkContextualizer } from "../ingestion/domain/MetadataChunkContextualizer.js";
import { PassthroughChunkContextualizer } from "../ingestion/domain/PassthroughChunkContextualizer.js";
import { E5TokenCounter } from "../ingestion/infrastructure/E5TokenCounter.js";
import { SemanticSearch } from "../retrieval/application/SemanticSearch.js";
import { JsonEmbeddingCache } from "../retrieval/infrastructure/JsonEmbeddingCache.js";
import { LocalE5EmbeddingProvider } from "../retrieval/infrastructure/LocalE5EmbeddingProvider.js";
import { Sha256TextHasher } from "../retrieval/infrastructure/Sha256TextHasher.js";
import { RunCoordinator } from "../runs/application/RunCoordinator.js";
import { RunExecutor } from "../runs/application/RunExecutor.js";
import { InMemoryRunRegistry } from "../runs/infrastructure/InMemoryRunRegistry.js";

export function createProductionApp() {
  const documents = new FileDocumentRepository();
  const modelCacheDir = fileURLToPath(
    new URL("../../data/model-cache", import.meta.url),
  );
  const embeddingModel = process.env.EMBEDDING_MODEL
    ?? "Xenova/multilingual-e5-small";
  const hasher = new Sha256TextHasher();
  const tokens = new E5TokenCounter({
    model: embeddingModel,
    cacheDir: modelCacheDir,
  });
  const chunker = new DocumentChunker([
    new CharacterWindowChunker(),
    new MarkdownHeadingChunker(),
    new TokenWindowChunker(tokens),
  ]);
  const ingestion = new DocumentIngestionPipeline(chunker, tokens, hasher);
  const contextualizers = {
    enabled: new MetadataChunkContextualizer(tokens, hasher),
    disabled: new PassthroughChunkContextualizer(tokens, hasher),
  };
  const embeddingProvider = new LocalE5EmbeddingProvider({
    model: embeddingModel,
    cacheDir: modelCacheDir,
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
    ingestion,
    tokens,
    contextualizers,
    embeddingProvider,
    embeddingCache,
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
  const failureLabComparison = new RunFailureLabComparison(
    new EvalRunner(search),
    treasuryEvalDataset,
  );

  return createApp({
    health: new HealthController(),
    documents: new DocumentsController(new ListDocuments(documents)),
    chunkPreview: new ChunkPreviewController(
      new PreviewDocumentChunks(
        documents,
        ingestion,
        tokens,
        contextualizers.enabled,
      ),
    ),
    semanticSearch: new SemanticSearchController(search),
    groundedAnswer: new GroundedAnswerController(answers),
    runs: new RunsController(runs, new SseRunConnectionFactory()),
    failureLab: new FailureLabController(
      new ListFailureLabExperiments(),
      failureLabComparison,
    ),
  });
}
