# Architecture

Treasury RAG Lab uses a small, feature-first Clean Architecture. The goal is
to make the RAG stages and their failure modes easy to inspect without adding
a framework around them.

## Map

```text
apps/api/src
├── documents/
│   ├── application/       list documents and document errors
│   ├── ports/             document repository contract
│   └── infrastructure/    filesystem-backed repository
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
- HTTP and React translate external events into application calls; they do not
  implement retrieval or grounding rules.
- `packages/contracts` remains the source of truth for HTTP payloads and SSE
  event shapes on both sides of the workspace.
- Concrete production dependencies are visible in
  `composition/create-production-app.ts`; no production singleton is hidden
  behind a getter or factory import.

Transformers.js exposes a process-wide `env` configuration object. Its cache
configuration is an SDK constraint and is confined to
`LocalE5EmbeddingProvider`; the provider pipeline itself is lazy state owned by
that adapter instance.

## Semantic search request

1. `SemanticSearchController` validates the body with the shared schema.
2. `SemanticSearch` selects global plus requested-tenant documents.
3. `DocumentChunker` dispatches to the configured chunking strategy.
4. `embedChunks` hashes chunk text, reads cached vectors and embeds misses.
5. The local E5 provider embeds the query with the query prefix.
6. `rankEmbeddedChunks` calculates cosine similarity, applies threshold and
   top-k, then creates deterministic ranked results.
7. The use case returns results plus cache, model and timing statistics.

Document selection, cosine similarity and ranking remain pure because they are
deterministic transformations without identity or lifecycle.

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

## Presenters and React

`HttpTreasuryRagGateway` is the only frontend object that calls `fetch` or
constructs `EventSource`. It owns URLs, methods, headers, contract parsing,
HTTP errors and stream cleanup.

Each lab has a React-free presenter with its own state, actions and lifecycle:

- `ChunkingLabPresenter` loads documents and previews strategies.
- `SemanticSearchLabPresenter` runs searches and formats ranking statistics.
- `GroundedAnswerLabPresenter` starts runs, reduces SSE events into a trace and
  closes requests or streams when stopped.

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
| `SemanticSearch` | Coordinate tenant-safe retrieval and result statistics. |
| `GenerateGroundedAnswer` | Coordinate retrieval, abstention, chat and validation. |
| `CitationValidator` | Enforce citation and tenant grounding policy. |
| `Run` | Own ordered event history, state and subscriptions. |
| `RunExecutor` | Translate answer progress into the run event protocol. |
| `SseRunConnection` | Own the lifetime of one HTTP event stream. |
| `HttpTreasuryRagGateway` | Own browser transport and contract parsing. |
| Lab presenters | Own UI state and lifecycle without depending on React. |

## Pure functions retained

- `cosineSimilarity`: vector mathematics.
- `rankEmbeddedChunks`: deterministic score/filter/sort/map pipeline.
- `selectDocuments`: tenant-selection policy without state.
- `validateEmbeddingBatch`: deterministic provider-output validation.
- grounding evaluation: deterministic checks over a completed answer.
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
