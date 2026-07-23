import type { SearchResult } from "@treasury-rag/contracts";

import type { ExpectedVersion } from "./evalCase.js";
import type { MetricResult } from "./evalReport.js";

/**
 * Latest-version selection: every retrieved chunk that belongs to the
 * expected policy family (documents sharing the title) must carry the
 * expected current version. A stale version inside the sources fails the
 * check even when the current version is also present.
 */
export function latestVersionMetric(
  expectedVersion: ExpectedVersion | undefined,
  sources: SearchResult[],
): MetricResult {
  if (!expectedVersion) {
    return {
      status: "notApplicable",
      detail: "El caso no fija una versión vigente esperada",
      value: null,
    };
  }

  const stale = sources.filter(
    (source) =>
      source.documentTitle === expectedVersion.documentTitle
      && source.version !== expectedVersion.version,
  );

  if (stale.length > 0) {
    return {
      status: "failed",
      detail: `Se recuperaron versiones no vigentes: ${
        stale.map((source) =>
          `${source.documentId} v${source.version} (${source.effectiveFrom})`
        ).join(", ")
      }`,
      value: 0,
    };
  }

  return {
    status: "passed",
    detail: `Sólo aparece la versión vigente v${expectedVersion.version} de “${expectedVersion.documentTitle}”`,
    value: 1,
  };
}
