import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  GroundedAnswerSchema,
  type GroundedAnswer,
} from "@treasury-rag/contracts";

import type {
  ChatProvider,
  GenerateGroundedAnswerInput,
} from "./chat-provider.js";
import {
  buildGroundedAnswerPrompt,
  GROUNDING_SYSTEM_PROMPT,
} from "./grounding-prompt.js";

type AnthropicChatProviderOptions = {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
};

export class AnthropicChatProvider implements ChatProvider {
  readonly id = "anthropic";
  readonly model: string;

  private readonly apiKey: string | undefined;
  private client: Anthropic | undefined;

  constructor(options: AnthropicChatProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "claude-haiku-4-5";
    this.client = options.client;
  }

  async generateGroundedAnswer(
    input: GenerateGroundedAnswerInput,
  ): Promise<GroundedAnswer> {
    const response = await this.getClient().messages.parse({
      model: this.model,
      max_tokens: 1_500,
      temperature: 0,
      system: GROUNDING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildGroundedAnswerPrompt(input),
        },
      ],
      output_config: {
        format: zodOutputFormat(GroundedAnswerSchema),
      },
    });

    if (!response.parsed_output) {
      throw new Error("Anthropic returned no structured grounded answer");
    }

    return GroundedAnswerSchema.parse(response.parsed_output);
  }

  private getClient(): Anthropic {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required to generate grounded answers",
      );
    }

    this.client = new Anthropic({ apiKey });
    return this.client;
  }
}
