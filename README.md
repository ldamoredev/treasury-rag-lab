# Treasury RAG Lab

An observable, intentionally breakable RAG laboratory for fictional treasury
policies. The project keeps each retrieval and generation stage explicit so its
successes and failure modes can be inspected.

## Current slice: visible chunking

The interface exposes two explicit chunking strategies:

- Character windows with configurable size and overlap.
- Markdown heading-aware sections with a configurable maximum size.

Every chunk preserves deterministic IDs, document metadata and exact source
offsets. The UI highlights repeated overlap and reports duplication and length
statistics so configuration changes can be inspected before retrieval exists.

API endpoints:

- `GET /api/documents`
- `POST /api/chunks/preview`

## Requirements

- Node.js 24 or newer
- pnpm 11 or newer

## Development

```bash
pnpm install
pnpm dev
```

The web application runs at <http://localhost:5173>. Vite proxies `/health` and
future `/api` requests to the Express API at <http://localhost:4000>.

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
