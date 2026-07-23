import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { CharacterWindowChunker } from "../../chunking/domain/CharacterWindowChunker.js";
import { DocumentChunker } from "../../chunking/domain/DocumentChunker.js";
import { MarkdownHeadingChunker } from "../../chunking/domain/MarkdownHeadingChunker.js";
import { FileDocumentRepository } from "../../documents/infrastructure/FileDocumentRepository.js";
import { GenerateGroundedAnswer } from "../../grounding/application/GenerateGroundedAnswer.js";
import { CitationValidator } from "../../grounding/domain/CitationValidator.js";
import { AnthropicChatProvider } from "../../grounding/infrastructure/AnthropicChatProvider.js";
import type { GroundedAnswerGenerator } from "../../grounding/ports/GroundedAnswerGenerator.js";
import { SemanticSearch } from "../../retrieval/application/SemanticSearch.js";
import { JsonEmbeddingCache } from "../../retrieval/infrastructure/JsonEmbeddingCache.js";
import { LocalE5EmbeddingProvider } from "../../retrieval/infrastructure/LocalE5EmbeddingProvider.js";
import { Sha256TextHasher } from "../../retrieval/infrastructure/Sha256TextHasher.js";
import { EvalRunner } from "../application/EvalRunner.js";
import type { EvalReport } from "../domain/evalReport.js";
import {
  TREASURY_EVAL_DATASET_VERSION,
  treasuryEvalDataset,
} from "../domain/treasuryEvalDataset.js";
import { AnthropicEvalGrader } from "../infrastructure/AnthropicEvalGrader.js";
import {
  ScriptedAnswerGenerator,
  type AnswerScript,
} from "../infrastructure/ScriptedAnswerGenerator.js";
import type { EvalGrader } from "../ports/EvalGrader.js";

type CliOptions = {
  live: boolean;
  grader: boolean;
  out: string | undefined;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { live: false, grader: false, out: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--live") {
      options.live = true;
    } else if (arg === "--grader") {
      options.grader = true;
    } else if (arg === "--out") {
      options.out = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.grader && !options.live) {
    throw new Error("--grader requires --live (model grading is a paid, opt-in stage)");
  }
  return options;
}

try {
  loadEnvFile(fileURLToPath(new URL("../../../../.env", import.meta.url)));
} catch {
  // The deterministic suite works without any environment file.
}

const options = parseArgs(process.argv.slice(2));

const documents = new FileDocumentRepository();
const chunker = new DocumentChunker([
  new CharacterWindowChunker(),
  new MarkdownHeadingChunker(),
]);
const embeddingProvider = new LocalE5EmbeddingProvider({
  model: process.env.EMBEDDING_MODEL ?? "Xenova/multilingual-e5-small",
  cacheDir: fileURLToPath(new URL("../../../data/model-cache", import.meta.url)),
});
const embeddingCache = new JsonEmbeddingCache({
  filePath: fileURLToPath(new URL("../../../data/index/embeddings.json", import.meta.url)),
  provider: embeddingProvider.id,
  model: embeddingProvider.model,
});
const search = new SemanticSearch(
  documents,
  chunker,
  embeddingProvider,
  embeddingCache,
  new Sha256TextHasher(),
);

const scripts = new Map<string, AnswerScript>(
  treasuryEvalDataset.map((evalCase) => [
    evalCase.query,
    evalCase.shouldAbstain
      ? { kind: "abstain" as const }
      : { kind: "answer" as const, text: evalCase.referenceAnswer },
  ]),
);

const answers: GroundedAnswerGenerator = options.live
  ? new GenerateGroundedAnswer(
      search,
      new AnthropicChatProvider({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
      }),
      new CitationValidator(),
    )
  : new ScriptedAnswerGenerator(search, scripts);

const grader: EvalGrader | undefined = options.grader
  ? new AnthropicEvalGrader()
  : undefined;

const runner = new EvalRunner(search, answers, grader);
const report = await runner.run(treasuryEvalDataset, {
  mode: "grounded",
  datasetVersion: TREASURY_EVAL_DATASET_VERSION,
  answerExecutor: options.live
    ? {
        provider: "anthropic",
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
      }
    : { provider: "scripted", model: "deterministic-fixture" },
});

const reportPath = await persistReport(report, options.out);
printSummary(report, reportPath);

if (report.failures.length > 0) {
  process.exitCode = 1;
}

async function persistReport(
  report: EvalReport,
  out: string | undefined,
): Promise<string> {
  const directory = fileURLToPath(
    new URL("../../../eval-reports", import.meta.url),
  );
  await mkdir(directory, { recursive: true });
  const filename = out
    ?? `eval-${report.generatedAt.replaceAll(":", "-").replace(".", "-")}.json`;
  const reportPath = filename.startsWith("/") || filename.includes(":")
    ? filename
    : `${directory}/${filename}`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function printSummary(report: EvalReport, reportPath: string): void {
  console.log(`\nEval report — ${report.generatedAt}`);
  console.log(
    `Modo: ${report.mode} · dataset v${report.configuration.datasetVersion} · ejecutor: ${
      report.configuration.answerExecutor
        ? `${report.configuration.answerExecutor.provider}/${report.configuration.answerExecutor.model}`
        : "ninguno"
    } · grader: ${
      report.configuration.grader
        ? `${report.configuration.grader.provider}/${report.configuration.grader.model}`
        : "no"
    }`,
  );

  for (const evalCase of report.cases) {
    if (evalCase.status === "error") {
      console.log(`  ✗ ${evalCase.caseId} — ERROR: ${evalCase.error}`);
      continue;
    }
    const failed = Object.entries(evalCase.metrics)
      .filter(([, metric]) => metric?.status === "failed")
      .map(([metric]) => metric);
    const marker = failed.length === 0 ? "✓" : "✗";
    console.log(
      `  ${marker} ${evalCase.caseId}${failed.length > 0 ? ` — fallas: ${failed.join(", ")}` : ""}`,
    );
    for (const [metric, result] of Object.entries(evalCase.metrics)) {
      if (result?.status === "failed") {
        console.log(`      ${metric}: ${result.detail}`);
      }
    }
  }

  console.log("\nMétricas agregadas (passed / failed / no aplica · rate):");
  for (const [metric, aggregate] of Object.entries(report.summary.metrics)) {
    const rate = aggregate.rate === null
      ? "n/a"
      : `${(aggregate.rate * 100).toFixed(0)}%`;
    console.log(
      `  ${metric.padEnd(24)} ${aggregate.passed}/${aggregate.failed}/${aggregate.notApplicable} · ${rate}`,
    );
  }

  console.log(
    `\nCasos: ${report.summary.completedCases} completados, ${report.summary.erroredCases} con error, ${report.failures.length} con fallas.`,
  );
  console.log(`Reporte guardado en ${reportPath}\n`);
}
