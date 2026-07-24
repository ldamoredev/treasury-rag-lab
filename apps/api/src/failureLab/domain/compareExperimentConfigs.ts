import type {
  ExperimentVariable,
  FailureLabConfig,
} from "@treasury-rag/contracts";

import { InvalidExperimentConfigError } from "./InvalidExperimentConfigError.js";

type FlatConfig = Partial<
  Record<ExperimentVariable, number | boolean | string | undefined>
>;

/**
 * Flattens a config into comparable variables. A change of chunking strategy
 * collapses into the single `chunkingStrategy` variable: swapping characters
 * for tokens necessarily replaces the parameters too, and reporting that as
 * several simultaneous changes would make a legitimate one-variable
 * experiment look uncontrolled.
 */
function flattenConfig(
  config: FailureLabConfig,
  comparableStrategies: boolean,
): FlatConfig {
  const shared: FlatConfig = {
    topK: config.topK,
    threshold: config.threshold,
    tenantFilter: config.tenantFilterEnabled,
    latestVersionFilter: config.latestVersionOnly,
    contextualIngestion: config.contextualIngestion,
  };

  const chunking = config.chunking;
  if (!comparableStrategies) {
    return { ...shared, chunkingStrategy: JSON.stringify(chunking) };
  }

  switch (chunking.strategy) {
    case "characters":
      return {
        ...shared,
        chunkingStrategy: chunking.strategy,
        chunkSize: chunking.chunkSize,
        overlap: chunking.overlap,
      };
    case "headings":
      return {
        ...shared,
        chunkingStrategy: chunking.strategy,
        maxChunkSize: chunking.maxChunkSize,
      };
    case "tokens":
      return {
        ...shared,
        chunkingStrategy: chunking.strategy,
        maxTokens: chunking.maxTokens,
        overlapTokens: chunking.overlapTokens,
      };
  }
}

export function changedVariables(
  baseline: FailureLabConfig,
  variant: FailureLabConfig,
): ExperimentVariable[] {
  const comparableStrategies =
    baseline.chunking.strategy === variant.chunking.strategy;
  const flatBaseline = flattenConfig(baseline, comparableStrategies);
  const flatVariant = flattenConfig(variant, comparableStrategies);
  const variables = new Set<ExperimentVariable>([
    ...(Object.keys(flatBaseline) as ExperimentVariable[]),
    ...(Object.keys(flatVariant) as ExperimentVariable[]),
  ]);

  return [...variables].filter(
    (variable) => flatBaseline[variable] !== flatVariant[variable],
  );
}

/**
 * The comparison engine only accepts single-variable experiments: changing
 * two knobs at once would make the observed failure impossible to attribute
 * to one layer.
 */
export function compareExperimentConfigs(
  baseline: FailureLabConfig,
  variant: FailureLabConfig,
): ExperimentVariable {
  const changed = changedVariables(baseline, variant);
  if (changed.length !== 1) {
    throw new InvalidExperimentConfigError(changed);
  }
  return changed[0]!;
}
