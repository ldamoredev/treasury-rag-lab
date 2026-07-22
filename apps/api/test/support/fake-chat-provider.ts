import type {
  GroundedAnswer,
} from "@treasury-rag/contracts";

import type {
  ChatProvider,
  GenerateGroundedAnswerInput,
  GroundedAnswerStreamEvent,
} from "../../src/grounding/ports/chat-provider.js";

export class FakeChatProvider implements ChatProvider {
  readonly id = "fake-chat";
  readonly model = "fake-grounded-model";
  readonly calls: GenerateGroundedAnswerInput[] = [];

  constructor(private readonly answer: GroundedAnswer) {}

  async *streamGroundedAnswer(
    input: GenerateGroundedAnswerInput,
  ): AsyncGenerator<GroundedAnswerStreamEvent> {
    this.calls.push(input);
    yield { type: "answer.delta", delta: this.answer.answer };
    yield { type: "answer.completed", answer: this.answer };
  }
}
