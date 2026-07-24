# Architecture

Treasury RAG Lab uses a small, feature-first Clean Architecture. The goal is
to make the RAG stages and their failure modes easy to inspect without adding
a framework around them.

## Map

```text
apps/api/src
├── documents/
│   ├── application/       list documents and document errors
│   ├── domain/            frontmatter-backed document parsing
│   ├── ports/             document repository contract
│   └── infrastructure/    filesystem-backed repository
├── ingestion/
│   ├── domain/            frontmatter, markdown structure, manifest, contextualizers
│   ├── application/       document ingestion pipeline
│   ├── ports/             token counter and contextualizer contracts
│   └── infrastructure/    tokenizer adapter
├── chunking/
│   ├── domain/            strategies, invariants and strategy selection
│   └── application/       chunk preview use case
├── retrieval/
│   ├── domain/            tenant selection, vector validation and ranking
│   ├── application/       embedding orchestration and semantic search
│   ├── ports/             provider, cache, hash and search contracts
│   └── infrastructure/    local E5, JSON cache and SHA-256 adapters
├── grounding/
│   ├── domain/            prompt policy and citation validation
│   ├── application/       grounded answer orchestration and abstention
│   ├── ports/             chat and answer-generation contracts
│   └── infrastructure/    Anthropic and streamed JSON adapters
├── runs/
│   ├── domain/            Run aggregate, subscriptions and evaluation
│   ├── application/       run coordination and execution
│   ├── ports/             lifecycle and registry contracts
│   └── infrastructure/    in-memory run registry with terminal TTL
├── evals/
│   ├── domain/            dataset, metrics, grading prompt and reports
│   ├── application/       per-case runner and aggregation orchestration
│   ├── ports/             optional model-grader contract
│   ├── infrastructure/    scripted executor and Anthropic grader
│   └── cli/               free and explicitly paid evaluation entrypoints
├── failureLab/
│   ├── domain/            single-variable experiments and config checks
│   └── application/       baseline-versus-variant comparison
├── http/
│   ├── controllers/       input validation and use-case invocation
│   ├── errors/            centralized HTTP error mapping
│   └── sse/               SSE connection lifecycle and serialization
├── composition/           production object graph
├── app.ts                 Express registration only
└── server.ts              environment and process startup

apps/web/src
├── core/
│   ├── ports/             TreasuryRagGateway contract
│   └── infrastructure/    fetch, Zod parsing and EventSource adapter
├── presenters/            React-free state, actions and ViewModels
├── ui/                    presenter hook and humble views
├── App.tsx                shell, navigation and composition
└── styles.css             visual presentation

packages/contracts         shared Zod schemas and transport types
```

Subdirectories exist only where a capability has more than one architectural
role. There is no generic `shared`, `utils` or base-class layer.

## Dependency rule

The normal call direction is:

```text
React / HTTP → application → domain and ports
                         ↑
              infrastructure adapters
```

- Domain and application code do not import Express, React, Anthropic,
  Transformers.js, filesystem or SSE details.
- Infrastructure implements small ports owned by the capability that needs
  them.
- `EvalRunner` depends on the existing search and answer ports. The optional
  Anthropic grader stays behind `EvalGrader` and is absent from free runs.
- HTTP and React translate external events into application calls; they do not
  implement retrieval or grounding rules.
- `packages/contracts` remains the source of truth for HTTP payloads and SSE
  event shapes on both sides of the workspace.
- Concrete production dependencies are visible in
  `composition/createProductionApp.ts`; no production singleton is hidden
  behind a getter or factory import.

Transformers.js exposes a process-wide `env` configuration object. Its cache
configuration is an SDK constraint and is confined to
`LocalE5EmbeddingProvider`; the provider pipeline itself is lazy state owned by
that adapter instance.

## Ingestion

`DocumentIngestionPipeline` owns one ordering — chunk, contextualize, account
— and nothing else. Strategies, tokenizer and contextualizer stay
replaceable behind their own contracts.

1. `MarkdownDocumentParser` reads the frontmatter block and validates the
   metadata with `DocumentSchema`. `content` is the body only, so offsets and
   citations do not move when metadata is edited.
2. `DocumentChunker` dispatches to characters, headings or token windows.
3. A `ChunkContextualizer` produces a `ContextualizedChunk`, adding
   `contextualPrefix`, `embeddingText`, `embeddingKey` and `tokenCount`
   **beside** the original `text`, never inside it.
4. `buildIngestionManifest` records the corpus hash, per-chunk offsets, keys
   and token counts, plus the chunking, tokenizer and contextualizer that
   produced them.

Ingestion is idempotent because it derives everything from the document
content and the configuration and keeps no state between runs: the same corpus
and configuration serialize to the same manifest.

There is no separate contextualization cache. The embedding cache key is
`sha256(contextualizerId | model | promptVersion | embeddingText)`, which
already covers document, chunk, prompt version, provider and model — so
changing any of them invalidates exactly the vectors it should, and a second
cache would only be a second thing to keep consistent. When contextualization
is off the key is the plain text hash, so vectors cached before this slice
stay valid.

The tokenizer is a loaded resource rather than a pure function. `TokenCounter`
exposes `load()` separately from `count()`: chunking stays synchronous, and
the callers that already are asynchronous make the tokenizer ready first.

Nothing generated ever reaches a citation. `text` is an exact slice of the
source at every stage, which makes the guarantee structural instead of a rule
somebody has to remember.

## Semantic search request

1. `SemanticSearchController` validates the body with the shared schema.
2. `SemanticSearch` selects global plus requested-tenant documents.
3. `DocumentIngestionPipeline` chunks and contextualizes them, choosing the
   enabled or disabled contextualizer from `contextualIngestion`.
4. `embedChunks` reads cached vectors by `embeddingKey` and embeds misses
   using `embeddingText`.
5. The local E5 provider embeds the query with the query prefix.
6. `rankEmbeddedChunks` calculates cosine similarity, applies threshold and
   top-k, then creates deterministic ranked results carrying both the citation
   text and the prefix that helped them rank.
7. The use case returns results plus cache, model, contextualizer and timing
   statistics.

Document selection, cosine similarity and ranking remain pure because they are
deterministic transformations without identity or lifecycle. Frontmatter
parsing, markdown structure, heading paths and manifest construction are pure
for the same reason.

### Why the tenant is not in the contextual prefix

Tenant isolation is decided by `selectDocuments` before anything is ranked.
Repeating the tenant inside the embedded text therefore adds no reachability —
only lexical bias. Measured on the dataset it cost 9 points of recall@k
(92% → 83%), because a question naming a tenant began outranking the global
policy that answered it. Whatever a deterministic filter has already settled
does not belong in the vector.

## Grounded answer request

1. `GroundedAnswerController` validates the request and enforces the grounded
   answer contract, including tenant isolation.
2. `GenerateGroundedAnswer` invokes semantic search.
3. Empty retrieval produces a deterministic abstention and does not invoke a
   chat provider.
4. Otherwise `AnthropicChatProvider` sends only the retrieved sources and uses
   the grounding prompt policy to treat their text as untrusted data.
5. `JsonAnswerDeltaExtractor` exposes only progressive answer text while the
   provider builds the structured result.
6. `CitationValidator` verifies every claim, citation and tenant boundary.
7. The response combines the validated answer, exact sources, retrieval stats
   and generation stats.

Provider failures are wrapped at the boundary and mapped centrally to stable,
sanitized HTTP errors. SDK messages and configuration details are logged by
the API but are not sent to clients.

## Run and SSE lifecycle

1. `RunCoordinator` creates and registers a `Run`, then schedules execution.
2. `RunExecutor` translates grounded-answer progress into the existing ordered
   run events and emits deterministic evaluation before completion.
3. `Run` owns the request snapshot, increasing event IDs, terminal invariant,
   event history and subscriber set. Consumers cannot mutate those values.
4. A subscriber receives events after `Last-Event-ID`; terminal histories are
   replayed without adding a live subscriber.
5. `SseRunConnection` owns headers, retry metadata, replay, named event writes,
   15-second heartbeats, disconnect cleanup and terminal close.
6. `InMemoryRunRegistry` retains a terminal run for five minutes and then
   removes it.
7. Failures produce `run.failed` with a controlled message and still enter the
   same terminal retention path.

The run aggregate and connection are classes because they protect mutable
state and resource lifecycle. SSE serialization and terminal-event predicates
remain pure functions.

## Evaluation pipeline

1. `treasuryEvalDataset` validates the ten versioned cases with Zod at module
   load time. Evidence expectations use document IDs plus text fragments, not
   chunk IDs whose offsets change with configuration.
2. `EvalRunner` executes each case independently through `PolicySearch`.
3. Retrieval metrics are calculated directly from the ranked sources.
4. In grounded mode, a `GroundedAnswerGenerator` supplies an answer and enables
   citation, exact-value and abstention checks.
5. An optional `EvalGrader` may score faithfulness, relevance and correctness.
   A grader failure marks grading unavailable without losing deterministic
   results.
6. `aggregateMetrics` keeps passed, failed and not-applicable counts explicit;
   only applicable results enter a rate denominator.
7. The CLI prints a compact human summary, persists a machine-readable JSON
   report and returns a failing exit status for case errors or failed metrics.

The default CLI wires local E5 retrieval to `ScriptedAnswerGenerator`. It is a
deterministic evaluator smoke test whose answers come from dataset references;
it must not be interpreted as a measurement of model generation. The live
entrypoints replace it with Anthropic generation and, only when separately
requested, `AnthropicEvalGrader`. Evaluations reveal regressions and trade-offs,
but neither deterministic checks nor an LLM grader prove correctness.

## Failure Lab comparison

1. `ListFailureLabExperiments` exposes six predefined experiment contracts.
2. `compareExperimentConfigs` rejects zero- or multi-variable comparisons.
3. `RunFailureLabComparison` runs the same dataset in retrieval-only mode for
   the baseline and variant, so the UI never triggers paid generation.
4. Aggregate rates become metric deltas and per-case outcomes become improved,
   degraded or unchanged groups.
5. The explanation identifies whether the variant caused a regression, the
   baseline was recovered by the variant, or the current dataset did not
   discriminate the change.
6. `FailureLabController` exposes the list and comparison endpoints through
   shared contracts; `FailureLabPresenter` owns loading, cancellation,
   selection and display formatting without depending on React.

The layer attribution is deliberate. Tenant and version failures are fixed in
document filtering; chunk-boundary failures in chunking; recall-window and
threshold failures in retrieval. Editing a prompt cannot repair evidence that
never entered the context.

## Presenters and React

`HttpTreasuryRagGateway` is the only frontend object that calls `fetch` or
constructs `EventSource`. It owns URLs, methods, headers, contract parsing,
HTTP errors and stream cleanup.

Each lab has a React-free presenter with its own state, actions and lifecycle:

- `ChunkingLabPresenter` loads documents and previews strategies.
- `SemanticSearchLabPresenter` runs searches and formats ranking statistics.
- `GroundedAnswerLabPresenter` starts runs, reduces SSE events into a trace and
  closes requests or streams when stopped.
- `FailureLabPresenter` loads controlled experiments and compares one selected
  baseline/variant pair.

`usePresenter` subscribes a presenter to React and pairs `start()` with
`stop()`. Presenter start/stop operations are idempotent, so React StrictMode
can mount and clean up safely. Views receive ViewModels and action methods;
they render and forward user intent without transport, parsing or business
rules.

## Main object responsibilities

| Object | Responsibility |
| --- | --- |
| `DocumentChunker` | Select an interchangeable strategy by configuration. |
| `CharacterWindowChunker` | Protect window, overlap, offset and ID invariants. |
| `MarkdownHeadingChunker` | Preserve heading-aware deterministic chunks. |
| `TokenWindowChunker` | Cut by token budget while keeping chunks literal source slices. |
| `MarkdownDocumentParser` | Validate frontmatter metadata against the document schema. |
| `DocumentIngestionPipeline` | Order chunking, contextualization and manifest accounting. |
| `MetadataChunkContextualizer` | Restore provenance without inventing text. |
| `E5TokenCounter` | Own the tokenizer resource and its lifecycle. |
| `SemanticSearch` | Coordinate tenant-safe retrieval and result statistics. |
| `GenerateGroundedAnswer` | Coordinate retrieval, abstention, chat and validation. |
| `CitationValidator` | Enforce citation and tenant grounding policy. |
| `Run` | Own ordered event history, state and subscriptions. |
| `RunExecutor` | Translate answer progress into the run event protocol. |
| `SseRunConnection` | Own the lifetime of one HTTP event stream. |
| `EvalRunner` | Execute cases independently and assemble deterministic and optional grading signals. |
| `RunFailureLabComparison` | Compare one-variable retrieval configurations over the same dataset. |
| `HttpTreasuryRagGateway` | Own browser transport and contract parsing. |
| Lab presenters | Own UI state and lifecycle without depending on React. |

## Pure functions retained

- `cosineSimilarity`: vector mathematics.
- `rankEmbeddedChunks`: deterministic score/filter/sort/map pipeline.
- `parseFrontmatter`: metadata/body separation without a YAML dependency.
- `findSectionRanges` and `headingPathAt`: markdown structure with exact offsets.
- `buildIngestionManifest`: deterministic accounting of one ingestion pass.
- `selectDocuments`: tenant-selection policy without state.
- `selectLatestDocumentVersions`: current-policy selection by family.
- `validateEmbeddingBatch`: deterministic provider-output validation.
- grounding evaluation: deterministic checks over a completed answer.
- eval metric calculation and aggregation: deterministic dataset checks.
- failure-lab config and case comparison: controlled experiment analysis.
- SSE serialization and terminal predicate: transport transformations.
- presentation formatting: deterministic labels and display values.

Turning these into classes would add indirection without identity, resources,
replaceable strategy or mutable invariants.

## Deliberate limits

The design borrows VDP's dependency direction, explicit composition, small
ports, presenters and test seams, but not its scale. Treasury RAG Lab has no DI
container, CQBus, general EventBus, module runtime, decorators, abstract base
classes, repository-per-object, Redux or internal framework. It also avoids
speculative clocks and ID services: constructor functions are enough where a
test needs deterministic time or IDs.

The in-memory run registry is intentionally process-local, the embedding cache
remains JSON, and the document corpus remains file-backed. Replacing those
adapters later does not require changing the use cases, but the current project
does not pay the complexity cost of distributed persistence.

## Dependencies considered and declined

Slice 8 added no runtime dependency. Three candidates were evaluated:

| Candidate | Version checked | Decision |
| --- | --- | --- |
| `gray-matter` | 4.0.3, MIT | Declined. It pulls `js-yaml ^3.13.1` — an obsolete major — to parse five scalar keys, and the values are validated by Zod either way. `parseFrontmatter` is ~40 pure, tested lines. |
| `unified` + `remark-parse` | 11.0.5 / 11.0.0, MIT | Declined. A full mdast AST costs about a dozen transitive packages, and reconstructing exact character offsets from it is *more* fragile than scanning ATX headings, not less. Offsets are what keep a chunk a literal slice of its source. |
| tokenizer from `@huggingface/transformers` | 3.8.1, already installed | Adopted. `AutoTokenizer` loads offline from the cached model in ~800 ms, so token counts match the embedding model exactly with no new dependency, no new download and no Docker impact. |

Each is reversible: the frontmatter reader and the heading scanner are pure
functions behind their own modules, and the tokenizer sits behind
`TokenCounter` with a deterministic fake, so no test loads a model.
