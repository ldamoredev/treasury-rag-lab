import type { FailureLabConfig } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import {
  changedVariables,
  compareExperimentConfigs,
} from "../src/failureLab/domain/compareExperimentConfigs.js";
import { InvalidExperimentConfigError } from "../src/failureLab/domain/InvalidExperimentConfigError.js";

const baseline: FailureLabConfig = {
  chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
  topK: 5,
  threshold: 0.7,
  tenantFilterEnabled: true,
  latestVersionOnly: true,
};

describe("experiment config comparison", () => {
  it("accepts configs that change exactly one variable", () => {
    const variant: FailureLabConfig = {
      ...baseline,
      chunking: { ...baseline.chunking, chunkSize: 900 },
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
      chunking: { ...baseline.chunking, overlap: 120 },
    };

    expect(changedVariables(baseline, variant)).toEqual(["overlap"]);
  });
});
