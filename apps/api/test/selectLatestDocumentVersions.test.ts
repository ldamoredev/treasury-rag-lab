import type { Document } from "@treasury-rag/contracts";
import { describe, expect, it } from "vitest";

import { selectLatestDocumentVersions } from "../src/retrieval/domain/selectLatestDocumentVersions.js";

function document(overrides: Partial<Document>): Document {
  return {
    id: "doc",
    title: "Política",
    content: "contenido",
    tenant: "global",
    version: 1,
    effectiveFrom: "2026-01-01",
    ...overrides,
  };
}

describe("latest document version selection", () => {
  it("keeps only the highest version of every policy family", () => {
    const documents = [
      document({ id: "policy-v2", version: 2, effectiveFrom: "2026-01-15" }),
      document({ id: "policy-v1", version: 1, effectiveFrom: "2025-03-01" }),
      document({ id: "other", title: "Otra política", tenant: "acme" }),
    ];

    const selected = selectLatestDocumentVersions(documents);

    expect(selected.map((candidate) => candidate.id)).toEqual([
      "policy-v2",
      "other",
    ]);
  });

  it("breaks version ties by the most recent effective date", () => {
    const documents = [
      document({ id: "older", version: 2, effectiveFrom: "2025-12-01" }),
      document({ id: "newer", version: 2, effectiveFrom: "2026-01-15" }),
    ];

    const selected = selectLatestDocumentVersions(documents);

    expect(selected.map((candidate) => candidate.id)).toEqual(["newer"]);
  });

  it("treats different titles as different families", () => {
    const documents = [
      document({ id: "a", title: "Política A", version: 1 }),
      document({ id: "b", title: "Política B", version: 1 }),
    ];

    expect(selectLatestDocumentVersions(documents)).toHaveLength(2);
  });
});
