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

export type GroundedAnswerStreamEvent =
  | { type: "answer.delta"; delta: string }
  | { type: "answer.completed"; answer: GroundedAnswer };

export type GroundedAnswerStreamOptions = {
  signal?: AbortSignal;
};

export interface ChatProvider {
  readonly id: string;
  readonly model: string;
  streamGroundedAnswer(
    input: GenerateGroundedAnswerInput,
    options?: GroundedAnswerStreamOptions,
  ): AsyncIterable<GroundedAnswerStreamEvent>;
}
