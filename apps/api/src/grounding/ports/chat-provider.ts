import type {
  GroundedAnswer,
} from "@treasury-rag/contracts";

import type { GroundingContext } from "../domain/grounding-context.js";

export type GenerateGroundedAnswerInput = GroundingContext;

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
