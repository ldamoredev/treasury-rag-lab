import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import {
  buildGradingPrompt,
  GRADER_SYSTEM_PROMPT,
} from "../domain/graderPrompt.js";
import type { EvalGrading } from "../domain/evalReport.js";
import type {
  EvalGrader,
  EvalGradingInput,
} from "../ports/EvalGrader.js";

const GradingOutputSchema = z.object({
  faithfulness: z.object({
    score: z.number().min(1).max(5),
    explanation: z.string().min(1),
    claims: z.array(z.object({
      claim: z.string().min(1),
      faithful: z.boolean(),
      explanation: z.string().min(1),
    })),
  }),
  relevance: z.object({
    score: z.number().min(1).max(5),
    explanation: z.string().min(1),
  }),
  correctness: z.object({
    score: z.number().min(1).max(5),
    explanation: z.string().min(1),
  }),
});

type AnthropicEvalGraderOptions = {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
};

/**
 * Paid, opt-in grader backed by Anthropic. Only constructed when the user
 * explicitly asks for model grading; the deterministic suite and the tests
 * never instantiate it.
 */
export class AnthropicEvalGrader implements EvalGrader {
  readonly id = "anthropic";
  readonly model: string;
  private client: Anthropic | undefined;

  constructor(options: AnthropicEvalGraderOptions = {}) {
    this.model = options.model
      ?? process.env.ANTHROPIC_MODEL
      ?? "claude-haiku-4-5";
    this.client = options.client;
  }

  async grade(input: EvalGradingInput): Promise<EvalGrading> {
    const message = await this.getClient().messages.parse({
      model: this.model,
      max_tokens: 2_000,
      temperature: 0,
      system: GRADER_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: buildGradingPrompt(input.evalCase, input.response),
      }],
      output_config: {
        format: zodOutputFormat(GradingOutputSchema),
      },
    });

    if (!message.parsed_output) {
      throw new Error("Anthropic returned no structured grading");
    }
    const output = GradingOutputSchema.parse(message.parsed_output);
    const origin = { provider: this.id, model: this.model } as const;

    return {
      faithfulness: { status: "graded", ...origin, ...output.faithfulness },
      relevance: { status: "graded", ...origin, ...output.relevance },
      correctness: { status: "graded", ...origin, ...output.correctness },
    };
  }

  private getClient(): Anthropic {
    if (this.client) {
      return this.client;
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for model grading");
    }
    this.client = new Anthropic({ apiKey });
    return this.client;
  }
}
