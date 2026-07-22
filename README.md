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

Optional embedding environment variable:

```bash
EMBEDDING_MODEL=Xenova/multilingual-e5-small pnpm dev
```

## Requirements

- Node.js 24 or newer
- pnpm 11 or newer

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
```

## Workspace

- `apps/api`: Express API
- `apps/web`: React and Vite frontend
- `packages/contracts`: runtime Zod contracts shared by both applications
