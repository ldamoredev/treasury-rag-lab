# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the author (an engineer learning and demonstrating Retrieval-Augmented
Generation) working at a desk, iterating on one lab at a time. Secondary audience:
technically fluent peers who encounter the project through a LinkedIn post and either
scan screenshots or open the live app to understand how RAG behaves. Both audiences are
here to *understand a mechanism*, not to manage production data.

## Product Purpose

An observable RAG laboratory for treasury / finance policy documents. It exists to make
each stage of a retrieval pipeline **visible and manipulable** so the mechanism can be
learned by doing: change one variable, watch the evidence change. Success is a visitor
who, after a few minutes, can explain *why* the system retrieved a given chunk or
answered a given way — and who found the experience clear and approachable enough to
keep exploring. The learning goal always wins over visual spectacle when the two conflict.

## Positioning

Most RAG demos show a chat box and hide the pipeline. This tool inverts that: it exposes
chunking, embedding/retrieval, grounded generation, and controlled failure comparison as
four inspectable labs, where **every metric and every answer traces back to the exact
source text that produced it**. Provenance is the product. A neighboring "chat with your
docs" demo cannot truthfully claim this transparency.

## Operating Context

- Four labs, switched from a single top navigation, each a self-contained task:
  1. **Chunking visible** — pick a document and a strategy (characters / headings / tokens),
     tune size and overlap, and see the resulting chunks, duplicated-by-overlap text
     (highlighted), token stats, and the contextual prefix that steers the vector but is
     never cited.
  2. **Búsqueda semántica** — embed a question locally (E5), retrieve top-k chunks by
     cosine similarity, and inspect ranking, score, threshold, top-k, tenant filtering,
     and contextual ingestion.
  3. **Grounded answer** — a conversational workbench: ask treasury questions, stream a
     grounded answer whose claims carry citation IDs, and open an evidence inspector
     (retrieval ranking, prompt context, SSE run trace, metrics/guardrails, run settings).
  4. **Failure Lab** — compare a baseline config against a variant that changes exactly
     one variable, and see which evaluation cases regress and which layer is responsible.
- Retrieval runs on local embeddings (no API key, cached after first download); grounded
  generation calls Anthropic. Tenant isolation (global / acme / boreal) is a first-class,
  non-negotiable guardrail surfaced in the UI.
- The API and web app run together in a pnpm monorepo (`apps/api`, `apps/web`,
  `packages/contracts`); the web app proxies `/api` to the local server.

## Capabilities and Constraints

- Architecture: React 19 + Vite; presenter / view-model layer (`src/presenters`) drives
  passive view components (`src/ui`). **Redesign work must preserve presenter contracts
  and view-model shapes** — the visual layer changes, the data flow does not.
- Language / voice: Rioplatense Spanish throughout ("Vos", "Preguntá", "Cambiá"),
  addressed to a curious practitioner. This is a durable constraint; copy stays Spanish.
- Pedagogical annotations are core content, not decoration: "Qué mirar", "Qué aprendemos",
  "Modelo local", "Sin costo", per-tab intros, and the failure-explanation blocks. They
  must remain prominent and legible in any redesign.
- Domain vocabulary to preserve exactly: chunk, overlap, token, contextual prefix /
  ingestión contextual, tenant, threshold, top-k, retrieval, grounded answer, claim,
  citation ID, guardrail, baseline vs variante, responsible layer.
- The tenant-isolation guardrail is locked in the UI and must always read as locked.

## Brand Commitments

- Name: **Treasury RAG Lab**; short mark "TR"; tagline "Laboratorio de evidencia".
- No external brand system, logo file, or fixed palette is binding — the visual world is
  open (this is the subject of the current redesign). The name, the "TR" mark concept, the
  Spanish voice, and the "evidence / laboratorio" framing are the durable identity anchors.

## Evidence on Hand

- Real, working labs backed by the API and a treasury policy corpus; test fixtures in
  `apps/web/src/presenters/__tests__/presenterFixtures.ts` provide representative
  documents, chunks, search stats, run events, and failure comparisons.
- No customers, testimonials, benchmarks, pricing, or deployment claims exist; none may be
  fabricated. Any illustrative data added for demonstration is synthetic and labeled.

## Product Principles

1. **Show the work.** Every number and every answer must be traceable to the source text;
   never present a result without a path back to its evidence.
2. **One variable at a time.** The tool teaches causality by isolating change — mirror that
   clarity in how controls and comparisons are presented.
3. **Teach in place.** Guidance lives next to the thing it explains, in plain Spanish, as a
   first-class part of the interface.
4. **Honest about cost and provenance.** Distinguish local/free operations from paid ones,
   and never let embedded context masquerade as citable evidence.
5. **Trustworthy by default.** Tenant isolation and guardrails are visible and locked, not
   hidden settings.

## Accessibility & Inclusion

Keyboard-operable controls, visible focus, and legible contrast are required — the tool is
meant to be easy to learn, and it is shown to a broad professional audience. Preserve the
existing semantic roles (tablist/tab/tabpanel, aria-live regions, alerts).
