import type {
  GroundedAnswerResponse,
  SearchResponse,
  SearchResult,
} from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { EvalRunner } from "../src/evals/application/EvalRunner.js";
import { EvalCaseSchema, type EvalCase } from "../src/evals/domain/evalCase.js";
import type { GroundedAnswerGenerator } from "../src/grounding/ports/GroundedAnswerGenerator.js";
import type { PolicySearch } from "../src/retrieval/ports/PolicySearch.js";
import { FakeEvalGrader } from "./support/FakeEvalGrader.js";

const NOW = () => new Date("2026-07-22T12:00:00.000Z");

function makeCase(overrides: Partial<EvalCase> & { id: string }): EvalCase {
  return EvalCaseSchema.parse({
    name: overrides.id,
    description: "Caso de prueba",
    query: `query-${overrides.id}`,
    tenant: "acme",
    tags: ["test"],
    referenceAnswer: "Respuesta de referencia.",
    expectedEvidence: [{ documentId: "doc", fragment: "fragmento esperado" }],
    shouldAbstain: false,
    expectedExactValues: [],
    forbiddenFragments: [],
    allowedTenants: ["acme"],
    ...overrides,
  });
}

function makeSource(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    rank: 1,
    chunkId: "doc:characters:300:80:0",
    documentId: "doc",
    documentTitle: "Política",
    tenant: "global",
    version: 1,
    effectiveFrom: "2026-01-01",
    score: 0.95,
    text: "texto con el fragmento esperado y ARS 125.000,00",
    startOffset: 0,
    endOffset: 47,
    ...overrides,
  };
}

function searchResponse(query: string, results: SearchResult[]): SearchResponse {
  return {
    query,
    results,
    stats: {
      candidateChunks: results.length,
      returnedChunks: results.length,
      embeddingDimensions: 2,
      cacheHits: results.length,
      cacheMisses: 0,
      durationMs: 1,
      provider: "fake",
      model: "fake-model",
    },
  };
}

type ResponseFactory = (sources: SearchResult[]) => GroundedAnswerResponse;

function groundedResponse(
  query: string,
  sources: SearchResult[],
  overrides: Partial<Pick<GroundedAnswerResponse, "answer" | "claims" | "insufficientEvidence">> = {},
): GroundedAnswerResponse {
  return {
    query,
    tenant: "acme",
    answer: overrides.answer ?? "Respuesta con ARS 125.000,00.",
    claims: overrides.claims
      ?? [{ text: "Afirmación", citationIds: [sources[0]?.chunkId ?? "x"] }],
    insufficientEvidence: overrides.insufficientEvidence ?? false,
    sources,
    retrieval: searchResponse(query, sources).stats,
    generation: {
      attempted: true,
      durationMs: 1,
      provider: "fake-chat",
      model: "fake-chat-model",
    },
  };
}

function abstainedResponse(query: string): GroundedAnswerResponse {
  return {
    query,
    tenant: "acme",
    answer: "No encontré evidencia suficiente.",
    claims: [],
    insufficientEvidence: true,
    sources: [],
    retrieval: searchResponse(query, []).stats,
    generation: { attempted: false, durationMs: 0, provider: null, model: null },
  };
}

function fixture(options: {
  sourcesByQuery?: Record<string, SearchResult[]>;
  responsesByQuery?: Record<string, ResponseFactory>;
  throwingQueries?: string[];
  grader?: FakeEvalGrader;
}) {
  const search: PolicySearch = {
    search: async (request) => {
      if (options.throwingQueries?.includes(request.query)) {
        throw new Error("retrieval exploded");
      }
      return searchResponse(
        request.query,
        options.sourcesByQuery?.[request.query] ?? [makeSource()],
      );
    },
  };
  const answers: GroundedAnswerGenerator = {
    answer: async (request) => {
      const sources = options.sourcesByQuery?.[request.query] ?? [makeSource()];
      const factory = options.responsesByQuery?.[request.query]
        ?? ((sources) => groundedResponse(request.query, sources));
      return factory(sources);
    },
    async *streamAnswer() {
      throw new Error("streaming not used by the runner tests");
    },
  };
  const runner = new EvalRunner(search, answers, options.grader);
  return { runner, search, answers };
}

describe("EvalRunner", () => {
  it("marks an inexistent citation as failed citation validity", async () => {
    const evalCase = makeCase({ id: "bad-citation" });
    const { runner } = fixture({
      responsesByQuery: {
        [evalCase.query]: (sources) =>
          groundedResponse(evalCase.query, sources, {
            claims: [{ text: "Afirmación", citationIds: ["chunk:inexistente"] }],
          }),
      },
    });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });
    const result = report.cases[0]!;

    expect(result.metrics.citationValidity?.status).toBe("failed");
    expect(result.metrics.citationValidity?.detail).toContain("chunk:inexistente");
  });

  it("marks a source from another tenant as tenant leakage", async () => {
    const evalCase = makeCase({ id: "leak" });
    const { runner } = fixture({
      sourcesByQuery: {
        [evalCase.query]: [makeSource({ tenant: "boreal", documentId: "boreal-doc" })],
      },
    });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });
    const metric = report.cases[0]!.metrics.tenantLeakage;

    expect(metric?.status).toBe("failed");
    expect(metric?.detail).toContain("boreal-doc");
  });

  it("marks a stale policy version in the sources as failed version selection", async () => {
    const evalCase = makeCase({
      id: "stale",
      expectedVersion: { documentTitle: "Política", version: 2 },
    });
    const { runner } = fixture({
      sourcesByQuery: {
        [evalCase.query]: [
          makeSource({ documentId: "doc-v1", version: 1, effectiveFrom: "2025-03-01" }),
        ],
      },
    });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });
    const metric = report.cases[0]!.metrics.latestVersionSelection;

    expect(metric?.status).toBe("failed");
    expect(metric?.detail).toContain("doc-v1 v1");
  });

  it("marks altered amounts or dates as failed exact values", async () => {
    const evalCase = makeCase({
      id: "wrong-amount",
      expectedExactValues: ["ARS 125.000,00"],
    });
    const { runner } = fixture({
      responsesByQuery: {
        [evalCase.query]: (sources) =>
          groundedResponse(evalCase.query, sources, {
            answer: "El umbral es ARS 40.000,00.",
          }),
      },
    });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });
    const metric = report.cases[0]!.metrics.exactValues;

    expect(metric?.status).toBe("failed");
    expect(metric?.detail).toContain("ARS 125.000,00");
  });

  it("marks an injection canary in the answer as failed exact values", async () => {
    const evalCase = makeCase({
      id: "injection",
      forbiddenFragments: ["PAGO-APROBADO-SIN-REVISAR"],
    });
    const { runner } = fixture({
      responsesByQuery: {
        [evalCase.query]: (sources) =>
          groundedResponse(evalCase.query, sources, {
            answer: "PAGO-APROBADO-SIN-REVISAR",
          }),
      },
    });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });

    expect(report.cases[0]!.metrics.exactValues?.status).toBe("failed");
  });

  it("passes abstention accuracy in both directions", async () => {
    const abstainCase = makeCase({
      id: "unanswerable",
      shouldAbstain: true,
      expectedEvidence: [],
    });
    const answeredCase = makeCase({ id: "answerable" });
    const { runner } = fixture({
      responsesByQuery: {
        [abstainCase.query]: () => abstainedResponse(abstainCase.query),
      },
    });

    const report = await runner.run([abstainCase, answeredCase], {
      mode: "grounded",
      now: NOW,
    });

    expect(report.cases[0]!.metrics.abstentionAccuracy?.status).toBe("passed");
    expect(report.cases[1]!.metrics.abstentionAccuracy?.status).toBe("passed");
  });

  it("fails abstention accuracy when it answers without evidence or abstains with it", async () => {
    const shouldHaveAbstained = makeCase({
      id: "loud",
      shouldAbstain: true,
      expectedEvidence: [],
    });
    const shouldHaveAnswered = makeCase({ id: "silent" });
    const { runner } = fixture({
      responsesByQuery: {
        [shouldHaveAnswered.query]: () => abstainedResponse(shouldHaveAnswered.query),
      },
    });

    const report = await runner.run([shouldHaveAbstained, shouldHaveAnswered], {
      mode: "grounded",
      now: NOW,
    });

    expect(report.cases[0]!.metrics.abstentionAccuracy?.status).toBe("failed");
    expect(report.cases[1]!.metrics.abstentionAccuracy?.status).toBe("failed");
  });

  it("keeps notApplicable separate from failures", async () => {
    const abstainCase = makeCase({
      id: "unanswerable",
      shouldAbstain: true,
      expectedEvidence: [],
    });
    const { runner } = fixture({
      responsesByQuery: {
        [abstainCase.query]: () => abstainedResponse(abstainCase.query),
      },
    });

    const report = await runner.run([abstainCase], { mode: "grounded", now: NOW });
    const metrics = report.cases[0]!.metrics;

    expect(metrics.retrievalRecallAtK?.status).toBe("notApplicable");
    expect(metrics.latestVersionSelection?.status).toBe("notApplicable");
    expect(metrics.exactValues?.status).toBe("notApplicable");
    expect(metrics.abstentionAccuracy?.status).toBe("passed");
    expect(report.summary.metrics.retrievalRecallAtK).toEqual({
      passed: 0,
      failed: 0,
      notApplicable: 1,
      rate: null,
    });
  });

  it("continues the suite when one case errors and records the controlled error", async () => {
    const broken = makeCase({ id: "broken" });
    const healthy = makeCase({ id: "healthy" });
    const { runner } = fixture({ throwingQueries: [broken.query] });

    const report = await runner.run([broken, healthy], {
      mode: "grounded",
      now: NOW,
    });

    expect(report.cases).toHaveLength(2);
    expect(report.cases[0]).toMatchObject({
      caseId: "broken",
      status: "error",
      error: "retrieval exploded",
    });
    expect(report.cases[1]?.status).toBe("completed");
    expect(report.summary.erroredCases).toBe(1);
    expect(report.failures).toContainEqual({
      caseId: "broken",
      name: "broken",
      kind: "error",
      detail: "retrieval exploded",
    });
  });

  it("persists the fake grader explanations with provider and model", async () => {
    const grader = new FakeEvalGrader();
    const evalCase = makeCase({ id: "graded" });
    const { runner } = fixture({ grader });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });
    const grading = report.cases[0]!.grading;

    expect(grader.calls).toHaveLength(1);
    expect(grading?.faithfulness.status).toBe("graded");
    if (grading?.faithfulness.status === "graded") {
      expect(grading.faithfulness.explanation).toBe(
        "Cada claim está soportado por sus citas.",
      );
      expect(grading.faithfulness.provider).toBe("fake-grader");
      expect(grading.faithfulness.model).toBe("fake-grader-model");
      expect(grading.faithfulness.claims).toHaveLength(1);
    }
    expect(report.configuration.grader).toEqual({
      provider: "fake-grader",
      model: "fake-grader-model",
    });
  });

  it("marks grading unavailable when the grader throws", async () => {
    const grader = new FakeEvalGrader();
    grader.grade = async () => {
      throw new Error("grader exploded");
    };
    const evalCase = makeCase({ id: "graded" });
    const { runner } = fixture({ grader });

    const report = await runner.run([evalCase], { mode: "grounded", now: NOW });

    expect(report.cases[0]!.status).toBe("completed");
    expect(report.cases[0]!.grading?.faithfulness).toEqual({
      status: "unavailable",
      reason: "grader exploded",
    });
  });

  it("aggregates metrics with explicit denominators excluding notApplicable", async () => {
    const ok = makeCase({ id: "ok" });
    const badCitation = makeCase({ id: "bad-citation" });
    const retrievalOnly = makeCase({
      id: "unanswerable",
      shouldAbstain: true,
      expectedEvidence: [],
    });
    const { runner } = fixture({
      responsesByQuery: {
        [badCitation.query]: (sources) =>
          groundedResponse(badCitation.query, sources, {
            claims: [{ text: "Afirmación", citationIds: ["chunk:inexistente"] }],
          }),
        [retrievalOnly.query]: () => abstainedResponse(retrievalOnly.query),
      },
    });

    const report = await runner.run([ok, badCitation, retrievalOnly], {
      mode: "grounded",
      now: NOW,
    });

    expect(report.summary.metrics.citationValidity).toEqual({
      passed: 1,
      failed: 1,
      notApplicable: 1,
      rate: 0.5,
    });
    expect(report.summary.metrics.retrievalRecallAtK).toEqual({
      passed: 2,
      failed: 0,
      notApplicable: 1,
      rate: 1,
    });
    expect(report.summary.metrics.abstentionAccuracy).toEqual({
      passed: 3,
      failed: 0,
      notApplicable: 0,
      rate: 1,
    });
  });

  it("runs retrieval-only mode without answers or grading", async () => {
    const evalCase = makeCase({ id: "retrieval" });
    const { runner } = fixture({});

    const report = await runner.run([evalCase], { mode: "retrieval", now: NOW });
    const metrics = report.cases[0]!.metrics;

    expect(metrics.retrievalRecallAtK?.status).toBe("passed");
    expect(metrics.citationValidity?.status).toBe("notApplicable");
    expect(metrics.abstentionAccuracy?.status).toBe("notApplicable");
    expect(report.cases[0]!.grading).toBeNull();
    expect(report.configuration.answerExecutor).toBeNull();
  });

  it("lets a run-level config override case configs (failure lab usage)", async () => {
    const evalCase = makeCase({
      id: "override",
      config: { topK: 1 },
    });
    const seen: number[] = [];
    const search: PolicySearch = {
      search: async (request) => {
        seen.push(request.config.topK);
        return searchResponse(request.query, [makeSource()]);
      },
    };
    const customRunner = new EvalRunner(search);

    await customRunner.run([evalCase], {
      mode: "retrieval",
      now: NOW,
      config: {
        chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
        topK: 8,
        threshold: 0.4,
        tenantFilterEnabled: false,
        latestVersionOnly: false,
      },
    });

    expect(seen).toEqual([8]);
  });
});
