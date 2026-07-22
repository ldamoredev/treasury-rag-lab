import type { DocumentRepository } from "../documents/repository.js";
import { getProductionGroundedAnswerService } from "../rag/production-grounded-answer-service.js";
import { createRunManager, type RunManager } from "./run-manager.js";

let singleton: RunManager | undefined;

export function getProductionRunManager(
  documentRepository: DocumentRepository,
): RunManager {
  if (!singleton) {
    singleton = createRunManager(
      getProductionGroundedAnswerService(documentRepository),
    );
  }

  return singleton;
}
