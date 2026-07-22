import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GroundedAnswerSchema } from "@treasury-rag/contracts";

import { ProviderUnavailableError } from "../application/ProviderUnavailableError.js";
import {
  buildGroundedAnswerPrompt,
  GROUNDING_SYSTEM_PROMPT,
} from "../domain/groundingPrompt.js";
import type {
  ChatProvider,
  GenerateGroundedAnswerInput,
  GroundedAnswerStreamEvent,
  GroundedAnswerStreamOptions,
} from "../ports/ChatProvider.js";
import { JsonAnswerDeltaExtractor } from "./JsonAnswerDeltaExtractor.js";

type AnthropicChatProviderOptions = {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
};

export class AnthropicChatProvider implements ChatProvider {
  readonly id = "anthropic";
  readonly model: string;
  private client: Anthropic | undefined;

  constructor(private readonly options: AnthropicChatProviderOptions = {}) {
    this.model = options.model ?? "claude-haiku-4-5";
    this.client = options.client;
  }

  async *streamGroundedAnswer(
    input: GenerateGroundedAnswerInput,
    options: GroundedAnswerStreamOptions = {},
  ): AsyncGenerator<GroundedAnswerStreamEvent> {
    try {
      const stream = this.getClient().messages.stream(
        {
          model: this.model,
          max_tokens: 1_500,
          temperature: 0,
          system: GROUNDING_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: buildGroundedAnswerPrompt(input),
          }],
          output_config: {
            format: zodOutputFormat(GroundedAnswerSchema),
          },
        },
        options.signal ? { signal: options.signal } : undefined,
      );
      const extractor = new JsonAnswerDeltaExtractor();
      let streamedAnswer = "";

      for await (const event of stream) {
        if (
          event.type !== "content_block_delta"
          || event.delta.type !== "text_delta"
        ) {
          continue;
        }
        const delta = extractor.push(event.delta.text);
        if (delta.length > 0) {
          streamedAnswer += delta;
          yield { type: "answer.delta", delta };
        }
      }

      const response = await stream.finalMessage();
      if (!response.parsed_output) {
        throw new Error("Anthropic returned no structured grounded answer");
      }
      const answer = GroundedAnswerSchema.parse(response.parsed_output);
      if (!answer.answer.startsWith(streamedAnswer)) {
        throw new Error("Streamed answer does not match the structured output");
      }

      const remainder = answer.answer.slice(streamedAnswer.length);
      if (remainder.length > 0) {
        yield { type: "answer.delta", delta: remainder };
      }
      yield { type: "answer.completed", answer };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        throw error;
      }
      throw new ProviderUnavailableError(error);
    }
  }

  private getClient(): Anthropic {
    if (this.client) {
      return this.client;
    }
    const apiKey = this.options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required to generate grounded answers",
      );
    }
    this.client = new Anthropic({ apiKey });
    return this.client;
  }
}
