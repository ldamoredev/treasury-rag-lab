import type {
  GroundedAnswer,
} from "@treasury-rag/contracts";

import type {
  ChatProvider,
  GenerateGroundedAnswerInput,
} from "../../src/generation/chat-provider.js";

export class FakeChatProvider implements ChatProvider {
  readonly id = "fake-chat";
  readonly model = "fake-grounded-model";
  readonly calls: GenerateGroundedAnswerInput[] = [];

  constructor(private readonly answer: GroundedAnswer) {}

  async generateGroundedAnswer(
    input: GenerateGroundedAnswerInput,
  ): Promise<GroundedAnswer> {
    this.calls.push(input);
    return this.answer;
  }
}
