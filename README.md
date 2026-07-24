# Treasury RAG Lab

An observable, intentionally breakable RAG laboratory for fictional treasury
policies. The project keeps each retrieval and generation stage explicit so its
successes and failure modes can be inspected.

## Current slices

### Slice 1: visible chunking

The interface exposes two explicit chunking strategies:

- Character windows with configurable size and overlap.
- Markdown heading-aware sections with a configurable maximum size.

Every chunk preserves deterministic IDs, document metadata and exact source
offsets. The UI highlights repeated overlap and reports duplication and length
statistics so configuration changes can be inspected before retrieval exists.

API endpoints:

- `GET /api/documents`
- `POST /api/chunks/preview`

### Slice 2: local semantic search

The retrieval lab embeds both questions and chunks locally with
`Xenova/multilingual-e5-small` through Transformers.js. It requires no API key
and sends no policy text to an embedding provider.

- E5 query and passage prefixes are applied by the API.
- Embeddings are mean-pooled, normalized 384-dimensional vectors.
- Chunk vectors are keyed by their SHA-256 text hash and persisted as readable
  JSON under `apps/api/data/index/embeddings.json`.
- The model artifacts are cached under `apps/api/data/model-cache`.
- Cosine similarity, top-k, threshold and tenant filtering remain explicit and
  adjustable in the UI.

The first search downloads the quantized model and builds the selected chunk
index. Later searches reuse both the downloaded model and matching chunk
vectors. Both cache directories are intentionally ignored by Git.

API endpoint:

- `POST /api/search`

### Slice 3: grounded answers with citations

The answer pipeline calls semantic search first, sends only the returned chunks
to Claude and requires a structured response with one or more citation IDs per
claim. The API validates the generated object with Zod and rejects every
citation that is not present in the retrieved context.

- Tenant isolation is mandatory for answer generation; only the requested
  tenant and global documents can enter the prompt.
- Retrieved text is explicitly marked as untrusted data so instructions inside
  a policy cannot override the system prompt.
- Empty retrieval returns a deterministic abstention without spending an API
  call.
- The UI keeps the answer, individual claims and their exact source chunks
  visible together.

API endpoint:

- `POST /api/answer`

Copy `.env.example` to `.env` or export the variables in your shell before
starting the app:

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-haiku-4-5
```

The Anthropic key is read only by the Express API and is never exposed to the
browser. The model can be changed through `ANTHROPIC_MODEL`.

### Slice 4: observable runs over SSE

Grounded answers can now run as a two-step asynchronous flow:

```http
POST /api/runs
GET /api/runs/:runId/events
```

The second endpoint is a `text/event-stream` connection that emits typed,
Zod-validated lifecycle events: run start, retrieval, generation, answer
deltas, deterministic evaluation, completion and failures. Every event carries
an increasing ID. Completed runs remain in memory for five minutes so an
automatically reconnecting `EventSource` can send `Last-Event-ID` and replay
only the missed events.

The server sends heartbeat comments every 15 seconds, disables proxy buffering
and releases the subscription and timer when the browser disconnects. The UI
shows both the progressively decoded `answer` field and the complete event
trace while preserving the final structured claims and citations.

### Slice 5: chat and evidence inspector

The grounded-answer screen is now a two-column workbench. The left side keeps
the user question, streamed answer, structured claims and clickable citations
in one conversation. The right side explains why that answer exists through
five focused views:

- `Retrieval` shows the ranked chunks and cosine scores.
- `Context` exposes the exact ordered text sent to the generation model.
- `Trace` keeps every typed SSE event in arrival order.
- `Metrics` separates retrieval statistics from deterministic guardrails.
- `Settings` controls chunking, top-k and threshold while tenant isolation
  remains locked on.

React still only renders the ViewModel and forwards user actions. Inspector
navigation, run configuration and SSE-derived state belong to the React-free
`GroundedAnswerLabPresenter`, so the behavior remains unit-testable without a
browser.

Optional embedding environment variable:

```bash
EMBEDDING_MODEL=Xenova/multilingual-e5-small pnpm dev
```

### Slice 6: reproducible evals

The evaluation suite contains exactly ten versioned treasury cases. They cover
single- and multi-chunk answers, paraphrases, tenant-specific rules, stale
policies, abstention, exact amounts and dates, prompt injection and an
ambiguous conflict. Expected evidence is anchored to document IDs and stable
text fragments instead of generated chunk IDs, so changing chunking does not
silently rewrite the ground truth.

`pnpm eval` is deterministic and free: it runs the real local E5 retrieval and
then uses a scripted answer executor derived from each case's reference answer.
That mode validates retrieval, metric computation, aggregation, reporting and
failure handling. It does **not** measure Claude's generative quality; exact
value and abstention results are expected to be strong because the executor is
an oracle fixture.

The report separates these signals for every case:

- retrieval recall@k over the expected evidence fragments;
- citation IDs that exist in the retrieved context;
- leakage from a tenant that was not allowed;
- selection of the current policy version;
- verbatim preservation of required amounts and dates;
- correct answer-versus-abstention behavior.

Every metric is `passed`, `failed` or `notApplicable`. Aggregate rates use only
`passed + failed` as their denominator; `notApplicable` remains visible without
being counted as a failure. One case error is recorded and does not abort the
remaining dataset. Reports are written as formatted JSON under
`apps/api/eval-reports/`, which is ignored by Git.

`pnpm eval:live` replaces the scripted executor with the real Anthropic answer
pipeline. `pnpm eval:live:grader` additionally asks an Anthropic grader for
claim faithfulness, relevance and correctness. Both commands are explicit,
paid opt-ins and require `ANTHROPIC_API_KEY`; tests and `pnpm eval` never make
those calls. A model grader is another noisy signal, not an objective judge.

### Slice 7: Failure Lab

Failure Lab runs the eval dataset twice with local retrieval: a baseline and a
variant that changes exactly one variable. Its API and UI show the two configs,
metric deltas, improved and degraded cases, the responsible layer and a
suggested correction.

Predefined experiments compare:

- chunk size 300 versus 900;
- overlap 0 versus 120;
- top-k 2 versus 8;
- similarity threshold 0.40 versus 0.80;
- tenant filtering on versus off;
- current-version filtering on versus off.

The comparison is retrieval-only and never calls Anthropic. Its explanations
follow the observed result: the failure may be in the variant, or in a weak
baseline that the variant recovers. Chunk size and top-k are trade-offs rather
than universal constants; recall measures evidence coverage but cannot by
itself prove that the final prompt is free of distracting context.

API endpoints:

- `GET /api/failure-lab/experiments`
- `POST /api/failure-lab/compare`

### Slice 8: contextual ingestion and token-aware chunking

A chunk can be cut correctly and still be unretrievable. “La diferencia se
considera aceptable” is a complete, well-formed sentence that says nothing
about which policy, which client or which section it belongs to — and the
vector does not know either.

Ingestion now separates what a chunk *is* from what it is *retrieved by*:

| Field | Meaning |
| --- | --- |
| `text` | Citation text — an exact slice of the source document. |
| `contextualPrefix` | Document title, version, effective date and heading path. |
| `embeddingText` | `contextualPrefix` + `text`, the string that becomes a vector. |
| `embeddingKey` | `sha256(contextualizer \| model \| promptVersion \| embeddingText)`. |
| `tokenCount` | Tokens actually spent, measured with the embedding tokenizer. |

`text` is never modified, so **a citation can never contain generated text**.
The prefix is built only from validated frontmatter and from headings that
appear literally in the document; nothing is invented.

Contextualization sits behind the `ChunkContextualizer` port with two
implementations — `MetadataChunkContextualizer` (deterministic, offline, the
default) and `PassthroughChunkContextualizer` (the pre-slice-8 behaviour). It
is selected per request through `contextualIngestion`, which defaults to
`false` in the schema so requests written before this slice describe the same
pipeline they always did.

Document metadata moved into per-file YAML-style frontmatter, replacing the
table that `FileDocumentRepository` used to keep alongside the corpus. The
body starts after the frontmatter, so offsets and existing citations are
unchanged.

A third chunking strategy joins the other two rather than replacing them:

```json
{ "strategy": "tokens", "maxTokens": 96, "overlapTokens": 24 }
```

It measures token budgets instead of character budgets, prefers heading
boundaries, and locates each cut by searching for the character offset whose
prefix fits the budget — so a chunk stays a literal slice of its source. This
matters more than it sounds: on this corpus and tokenizer, Spanish treasury
prose runs at **~5.3 characters per token**, so the familiar `chunkSize: 300`
is about 57 tokens, not the ~75 the usual four-characters-per-token rule
suggests. The chunking lab now reports tokens per chunk and the extra tokens
contextualization costs.

Two Failure Lab experiments compare one variable each: `contextual ingestion
off vs on` and `characters vs token-aware`.

#### What the measurements showed

Contextual ingestion is not free, and the dataset says so:

- On the same seven-document corpus, recall@k went from **75% to 92%**.
- Including the **tenant** in the prefix made things *worse* (83%): a question
  naming a tenant started outranking the global rule that answered it. The
  tenant is already enforced deterministically before ranking, so putting it
  in the vector adds bias without adding reach. It was removed.
- `ambiguous-tenant-conflict` **regressed and is left failing**. It needs
  evidence from two documents at `topK: 5`, and contextualization pushed the
  global chunk from the top five to rank 13. The oracle was not relaxed and
  the case was not re-tuned to hide it: `pnpm eval` reports 92% recall@k and
  exits non-zero. Reranking and hybrid retrieval are the honest fixes, and
  they belong to later slices.
- Simply adding two documents to the corpus broke `distributed-two-chunks`
  before contextualization was involved at all. More corpus at a fixed `topK`
  means less recall.

## Requirements

- Node.js 24 or newer
- pnpm 11 or newer

## Architecture

The code is organized by capability (`documents`, `chunking`, `retrieval`,
`grounding`, `runs`, `evals` and `failureLab`) with explicit application,
domain, port and infrastructure boundaries where they add value. Production
dependencies are assembled in one composition root. The frontend uses a single
HTTP/SSE gateway and React-free presenters, leaving React components focused on
rendering and user intent.

See [the architecture guide](docs/architecture.md) for the dependency rule,
request flows, run lifecycle, principal objects and deliberate complexity
limits.

## Development

```bash
pnpm install
pnpm dev
```

The web application runs at <http://localhost:5173>. Vite proxies `/health` and
`/api` requests to the Express API at <http://localhost:4000>.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm eval
```

`pnpm eval` currently exits non-zero: `ambiguous-tenant-conflict` fails its
recall check for the reason documented under slice 8. That failure is a
recorded trade-off, not an unnoticed break.

Optional paid verification:

```bash
pnpm eval:live
pnpm eval:live:grader
```

## Workspace

- `apps/api`: Express API
- `apps/web`: React/Vite frontend with a gateway and React-free presenters
- `packages/contracts`: runtime Zod contracts shared by both applications
- `docs/architecture.md`: boundaries, flows and design decisions
