import type {
  GroundedAnswerRequest,
  GroundedAnswerResponse,
  SearchResult,
  SearchStats,
} from "@treasury-rag/contracts";

export type GroundedAnswerOptions = {
  signal?: AbortSignal;
};

export type GroundedAnswerProgressEvent =
  | { type: "retrieval.started"; query: string }
  | {
      type: "retrieval.completed";
      sources: SearchResult[];
      stats: SearchStats;
    }
  | { type: "generation.started"; provider: string; model: string }
  | { type: "answer.delta"; delta: string }
  | { type: "answer.completed"; response: GroundedAnswerResponse };

export interface GroundedAnswerGenerator {
  answer(
    request: GroundedAnswerRequest,
    options?: GroundedAnswerOptions,
  ): Promise<GroundedAnswerResponse>;
  streamAnswer(
    request: GroundedAnswerRequest,
    options?: GroundedAnswerOptions,
  ): AsyncIterable<GroundedAnswerProgressEvent>;
}
