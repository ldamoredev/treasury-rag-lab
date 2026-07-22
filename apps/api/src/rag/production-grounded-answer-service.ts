import type { DocumentRepository } from "../documents/repository.js";
import { AnthropicChatProvider } from "../generation/anthropic-chat-provider.js";
import { getProductionSearchService } from "../search/production-search-service.js";
import {
  createGroundedAnswerService,
  type GroundedAnswerService,
} from "./grounded-answer-service.js";

let singleton: GroundedAnswerService | undefined;

export function getProductionGroundedAnswerService(
  documentRepository: DocumentRepository,
): GroundedAnswerService {
  if (singleton) {
    return singleton;
  }

  singleton = createGroundedAnswerService({
    searchService: getProductionSearchService(documentRepository),
    chatProvider: new AnthropicChatProvider({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
    }),
  });

  return singleton;
}
