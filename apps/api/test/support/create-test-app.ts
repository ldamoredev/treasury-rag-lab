import { createApp } from "../../src/app.js";
import { PreviewDocumentChunks } from "../../src/chunking/application/preview-document-chunks.js";
import { CharacterWindowChunker } from "../../src/chunking/domain/character-window-chunker.js";
import { DocumentChunker } from "../../src/chunking/domain/document-chunker.js";
import { MarkdownHeadingChunker } from "../../src/chunking/domain/markdown-heading-chunker.js";
import { ListDocuments } from "../../src/documents/application/list-documents.js";
import { FileDocumentRepository } from "../../src/documents/infrastructure/file-document-repository.js";
import type { DocumentRepository } from "../../src/documents/ports/document-repository.js";
import type { GroundedAnswerGenerator } from "../../src/grounding/ports/grounded-answer-generator.js";
import { ChunkPreviewController } from "../../src/http/controllers/chunk-preview-controller.js";
import { DocumentsController } from "../../src/http/controllers/documents-controller.js";
import { GroundedAnswerController } from "../../src/http/controllers/grounded-answer-controller.js";
import { HealthController } from "../../src/http/controllers/health-controller.js";
import { RunsController } from "../../src/http/controllers/runs-controller.js";
import { SemanticSearchController } from "../../src/http/controllers/semantic-search-controller.js";
import { SseRunConnectionFactory } from "../../src/http/sse/sse-run-connection-factory.js";
import type { PolicySearch } from "../../src/retrieval/ports/policy-search.js";
import type { RunLifecycle } from "../../src/runs/ports/run-lifecycle.js";

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
