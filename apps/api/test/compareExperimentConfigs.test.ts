import type {
  CharacterChunkingConfig,
  FailureLabConfig,
} from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import {
  changedVariables,
  compareExperimentConfigs,
} from "../src/failureLab/domain/compareExperimentConfigs.js";
import { InvalidExperimentConfigError } from "../src/failureLab/domain/InvalidExperimentConfigError.js";

const BASELINE_CHUNKING: CharacterChunkingConfig = {
  strategy: "characters",
  chunkSize: 300,
  overlap: 0,
};

const baseline: FailureLabConfig = {
  chunking: BASELINE_CHUNKING,
  topK: 5,
  threshold: 0.7,
  tenantFilterEnabled: true,
  latestVersionOnly: true,
  contextualIngestion: false,
};

describe("experiment config comparison", () => {
  it("accepts configs that change exactly one variable", () => {
    const variant: FailureLabConfig = {
      ...baseline,
      chunking: { ...BASELINE_CHUNKING, chunkSize: 900 },
    };

    expect(compareExperimentConfigs(baseline, variant)).toBe("chunkSize");
  });

  it("rejects identical configs (zero changed variables)", () => {
    expect(() => compareExperimentConfigs(baseline, { ...baseline })).toThrow(
      InvalidExperimentConfigError,
    );
    expect(() => compareExperimentConfigs(baseline, { ...baseline })).toThrow(
      /exactly one variable/,
    );
  });

  it("rejects configs that change two or more variables", () => {
    const variant: FailureLabConfig = {
      ...baseline,
      topK: 8,
      threshold: 0.4,
    };

    expect(changedVariables(baseline, variant)).toEqual(["topK", "threshold"]);
    expect(() => compareExperimentConfigs(baseline, variant)).toThrow(
      "changed: topK, threshold",
    );
  });

  it("detects changes inside the chunking object", () => {
    const variant: FailureLabConfig = {
      ...baseline,
      chunking: { ...BASELINE_CHUNKING, overlap: 120 },
    };

    expect(changedVariables(baseline, variant)).toEqual(["overlap"]);
  });

  it("detects contextual ingestion as a single changed variable", () => {
    const variant: FailureLabConfig = {
      ...baseline,
      contextualIngestion: true,
    };

    expect(compareExperimentConfigs(baseline, variant)).toBe(
      "contextualIngestion",
    );
  });

  it("treats a chunking strategy swap as one variable, not four", () => {
    // Replacing characters with tokens necessarily replaces the parameters
    // too. Counting each parameter separately would reject a controlled
    // experiment that only changes how the document is cut.
    const variant: FailureLabConfig = {
      ...baseline,
      chunking: { strategy: "tokens", maxTokens: 96, overlapTokens: 24 },
    };

    expect(compareExperimentConfigs(baseline, variant)).toBe(
      "chunkingStrategy",
    );
  });

  it("still rejects a strategy swap combined with another change", () => {
    const variant: FailureLabConfig = {
      ...baseline,
      chunking: { strategy: "headings", maxChunkSize: 600 },
      topK: 8,
    };

    expect(() => compareExperimentConfigs(baseline, variant)).toThrow(
      InvalidExperimentConfigError,
    );
  });
});
