import type {
  ExperimentVariable,
  FailureLabConfig,
} from "@treasury-rag/contracts";

import { InvalidExperimentConfigError } from "./InvalidExperimentConfigError.js";

function flattenConfig(
  config: FailureLabConfig,
): Record<ExperimentVariable, number | boolean | string> {
  return {
    chunkingStrategy: config.chunking.strategy,
    chunkSize: config.chunking.chunkSize,
    overlap: config.chunking.overlap,
    topK: config.topK,
    threshold: config.threshold,
    tenantFilter: config.tenantFilterEnabled,
    latestVersionFilter: config.latestVersionOnly,
  };
}

export function changedVariables(
  baseline: FailureLabConfig,
  variant: FailureLabConfig,
): ExperimentVariable[] {
  const flatBaseline = flattenConfig(baseline);
  const flatVariant = flattenConfig(variant);

  return (Object.keys(flatBaseline) as ExperimentVariable[]).filter(
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
