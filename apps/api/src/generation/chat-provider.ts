import type {
  GroundedAnswer,
  SearchResult,
  Tenant,
} from "@treasury-rag/contracts";

export type GenerateGroundedAnswerInput = {
  query: string;
  tenant: Tenant;
  sources: SearchResult[];
};

export interface ChatProvider {
  readonly id: string;
  readonly model: string;
  generateGroundedAnswer(
    input: GenerateGroundedAnswerInput,
  ): Promise<GroundedAnswer>;
}
