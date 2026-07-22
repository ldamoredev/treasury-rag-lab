import { createApp } from "../../src/app.js";
import { PreviewDocumentChunks } from "../../src/chunking/application/PreviewDocumentChunks.js";
import { CharacterWindowChunker } from "../../src/chunking/domain/CharacterWindowChunker.js";
import { DocumentChunker } from "../../src/chunking/domain/DocumentChunker.js";
import { MarkdownHeadingChunker } from "../../src/chunking/domain/MarkdownHeadingChunker.js";
import { ListDocuments } from "../../src/documents/application/ListDocuments.js";
import { FileDocumentRepository } from "../../src/documents/infrastructure/FileDocumentRepository.js";
import type { DocumentRepository } from "../../src/documents/ports/DocumentRepository.js";
import type { GroundedAnswerGenerator } from "../../src/grounding/ports/GroundedAnswerGenerator.js";
import { ChunkPreviewController } from "../../src/http/controllers/ChunkPreviewController.js";
import { DocumentsController } from "../../src/http/controllers/DocumentsController.js";
import { GroundedAnswerController } from "../../src/http/controllers/GroundedAnswerController.js";
import { HealthController } from "../../src/http/controllers/HealthController.js";
import { RunsController } from "../../src/http/controllers/RunsController.js";
import { SemanticSearchController } from "../../src/http/controllers/SemanticSearchController.js";
import { SseRunConnectionFactory } from "../../src/http/sse/SseRunConnectionFactory.js";
import type { PolicySearch } from "../../src/retrieval/ports/PolicySearch.js";
import type { RunLifecycle } from "../../src/runs/ports/RunLifecycle.js";

type TestAppOverrides = {
  documentRepository?: DocumentRepository;
  policySearch?: PolicySearch;
  groundedAnswerGenerator?: GroundedAnswerGenerator;
  runs?: RunLifecycle;
};

const unavailableSearch: PolicySearch = {
  search: async () => {
    throw new Error("No policy search configured for this test");
  },
};

const unavailableAnswers: GroundedAnswerGenerator = {
  answer: async () => {
    throw new Error("No grounded answer generator configured for this test");
  },
  async *streamAnswer() {
    throw new Error("No grounded answer generator configured for this test");
  },
};

const unavailableRuns: RunLifecycle = {
  create: () => {
    throw new Error("No run lifecycle configured for this test");
  },
  subscribe: () => undefined,
};

export function createTestApp(overrides: TestAppOverrides = {}) {
  const documents = overrides.documentRepository
    ?? new FileDocumentRepository();
  const chunker = new DocumentChunker([
    new CharacterWindowChunker(),
    new MarkdownHeadingChunker(),
  ]);

  return createApp({
    health: new HealthController(),
    documents: new DocumentsController(new ListDocuments(documents)),
    chunkPreview: new ChunkPreviewController(
      new PreviewDocumentChunks(documents, chunker),
    ),
    semanticSearch: new SemanticSearchController(
      overrides.policySearch ?? unavailableSearch,
    ),
    groundedAnswer: new GroundedAnswerController(
      overrides.groundedAnswerGenerator ?? unavailableAnswers,
    ),
    runs: new RunsController(
      overrides.runs ?? unavailableRuns,
      new SseRunConnectionFactory(),
    ),
  });
}
