import type { Document } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import type { DocumentRepository } from "../src/documents/ports/DocumentRepository.js";
import { EvalCaseSchema, type EvalCase } from "../src/evals/domain/evalCase.js";
import { EvalRunner } from "../src/evals/application/EvalRunner.js";
import { ExperimentNotFoundError } from "../src/failureLab/application/ExperimentNotFoundError.js";
import {
  describeObservedFailure,
  RunFailureLabComparison,
} from "../src/failureLab/application/RunFailureLabComparison.js";
import { failureLabExperiments } from "../src/failureLab/domain/failureLabExperiments.js";
import { createSemanticSearch } from "./support/createSemanticSearch.js";
import { FakeEmbeddingProvider } from "./support/FakeEmbeddingProvider.js";
import { MemoryEmbeddingCache } from "./support/MemoryEmbeddingCache.js";

const NOW = () => new Date("2026-07-22T12:00:00.000Z");

const THRESHOLD_QUERY = "¿Cuál es el umbral de escalamiento?";
const TENANT_QUERY = "¿Qué regla aplica al cliente?";

const documents: Document[] = [
  {
    id: "global-v2",
    title: "Política global",
    content: "Umbral vigente ARS 125.000,00 para escalamiento.",
    tenant: "global",
    version: 2,
    effectiveFrom: "2026-01-15",
  },
  {
    id: "global-v1",
    title: "Política global",
    content: "Umbral viejo ARS 40.000,00 para escalamiento.",
    tenant: "global",
    version: 1,
    effectiveFrom: "2025-03-01",
  },
  {
    id: "acme-policy",
    title: "Política Acme",
    content: "Acme requiere aprobación humana siempre.",
    tenant: "acme",
    version: 1,
    effectiveFrom: "2026-02-01",
  },
  {
    id: "boreal-policy",
    title: "Política Boreal",
    content: "Boreal permite aplicación automática.",
    tenant: "boreal",
    version: 1,
    effectiveFrom: "2026-02-01",
  },
];

const repository: DocumentRepository = {
  list: () => documents.map((document) => ({ ...document })),
  findById: (id) => documents.find((document) => document.id === id),
};

const dataset: EvalCase[] = [
  EvalCaseSchema.parse({
    id: "version-case",
    name: "Caso de versión vigente",
    description: "Espera la versión 2 de la política global.",
    query: THRESHOLD_QUERY,
    tenant: "acme",
    tags: ["versioning"],
    referenceAnswer: "ARS 125.000,00.",
    expectedEvidence: [{ documentId: "global-v2", fragment: "125.000,00" }],
    shouldAbstain: false,
    expectedExactValues: [],
    forbiddenFragments: [],
    expectedVersion: { documentTitle: "Política global", version: 2 },
    allowedTenants: ["acme"],
  }),
  EvalCaseSchema.parse({
    id: "tenant-case",
    name: "Caso de aislamiento",
    description: "Espera sólo evidencia del tenant acme o global.",
    query: TENANT_QUERY,
    tenant: "acme",
    tags: ["tenant-isolation"],
    referenceAnswer: "Aprobación humana.",
    expectedEvidence: [{ documentId: "acme-policy", fragment: "aprobación humana" }],
    shouldAbstain: false,
    expectedExactValues: [],
    forbiddenFragments: [],
    allowedTenants: ["acme"],
  }),
];

function createComparison() {
  const provider = new FakeEmbeddingProvider({
    documents: {
      [documents[0]!.content]: [0.98, 0.199],
      [documents[1]!.content]: [0.995, 0.1],
      [documents[2]!.content]: [0.1, 0.995],
      [documents[3]!.content]: [0.05, 0.9987],
    },
    queries: {
      [THRESHOLD_QUERY]: [1, 0],
      [TENANT_QUERY]: [0, 1],
    },
  });
  const search = createSemanticSearch(
    repository,
    provider,
    new MemoryEmbeddingCache(),
  );
  return new RunFailureLabComparison(
    new EvalRunner(search),
    dataset,
    NOW,
  );
}

describe("failure lab comparison", () => {
  it("explains when the failure is in the baseline and the variant recovers it", () => {
    const experiment = failureLabExperiments.find(
      (candidate) => candidate.id === "overlap-0-vs-120",
    )!;
    const improved = [{
      caseId: "split-rule",
      name: "Regla cortada",
      baselineStatus: "failed" as const,
      variantStatus: "passed" as const,
      detail: "retrievalRecallAtK: failed → passed",
    }];

    expect(describeObservedFailure(experiment, improved, [])).toContain(
      "El baseline falló",
    );
    expect(describeObservedFailure(experiment, improved, [])).toContain(
      "split-rule",
    );
  });

  it("rejects unknown experiments with a controlled error", async () => {
    const comparison = createComparison();

    await expect(comparison.run("missing-experiment")).rejects.toThrow(
      ExperimentNotFoundError,
    );
  });

  it("exposes tenant leakage when the tenant filter is disabled", async () => {
    const comparison = createComparison();

    const result = await comparison.run("tenant-filter-on-vs-off");

    expect(result.mode).toBe("retrieval");
    expect(result.degradedCases.map((change) => change.caseId)).toEqual([
      "tenant-case",
    ]);
    expect(result.degradedCases[0]).toMatchObject({
      baselineStatus: "passed",
      variantStatus: "failed",
      detail: "tenantLeakage: passed → failed",
    });
    expect(result.improvedCases).toEqual([]);
    expect(result.unchangedCases).toBe(1);
    expect(result.observedFailure).toContain("tenant-case");
    expect(result.responsibleLayer).toBe("filtering");
  });

  it("computes metric deltas between baseline and variant", async () => {
    const comparison = createComparison();

    const result = await comparison.run("tenant-filter-on-vs-off");
    const leakage = result.metricDeltas.find(
      (delta) => delta.metric === "tenantLeakage",
    );

    expect(leakage?.baseline.rate).toBe(1);
    expect(leakage?.variant.rate).toBe(0.5);
    expect(leakage?.delta).toBe(-0.5);
  });

  it("exposes stale version selection when the latest-version filter is disabled", async () => {
    const comparison = createComparison();

    const result = await comparison.run("latest-version-on-vs-off");

    expect(result.degradedCases.map((change) => change.caseId)).toEqual([
      "version-case",
    ]);
    expect(result.degradedCases[0]?.detail).toBe(
      "latestVersionSelection: passed → failed",
    );
    const versionDelta = result.metricDeltas.find(
      (delta) => delta.metric === "latestVersionSelection",
    );
    expect(versionDelta?.baseline.rate).toBe(1);
    expect(versionDelta?.variant.rate).toBe(0);
    expect(versionDelta?.delta).toBe(-1);
  });

  it("keeps unrelated metrics notApplicable without counting them as failures", async () => {
    const comparison = createComparison();

    const result = await comparison.run("chunk-size-300-vs-900");
    const citations = result.metricDeltas.find(
      (delta) => delta.metric === "citationValidity",
    );

    expect(citations?.baseline.notApplicable).toBe(2);
    expect(citations?.baseline.rate).toBeNull();
    expect(citations?.delta).toBeNull();
    expect(result.degradedCases).toEqual([]);
  });
});
