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

Optional environment variable:

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
