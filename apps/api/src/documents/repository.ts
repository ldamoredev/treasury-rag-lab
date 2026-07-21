import { readFileSync } from "node:fs";

import { DocumentSchema, type Document } from "@treasury-rag/contracts";

type DocumentDefinition = Omit<Document, "content"> & {
  filename: string;
};

const definitions: DocumentDefinition[] = [
  {
    id: "partial-payments",
    title: "Política global de pagos parciales",
    tenant: "global",
    version: 2,
    effectiveFrom: "2026-01-15",
    filename: "partial-payments.md",
  },
  {
    id: "acme-approvals",
    title: "Aprobaciones de tesorería — Acme",
    tenant: "acme",
    version: 1,
    effectiveFrom: "2026-02-01",
    filename: "acme-approvals.md",
  },
  {
    id: "boreal-approvals",
    title: "Aprobaciones de tesorería — Boreal",
    tenant: "boreal",
    version: 1,
    effectiveFrom: "2026-02-01",
    filename: "boreal-approvals.md",
  },
];

const documents = definitions.map(({ filename, ...metadata }) => {
  const fileUrl = new URL(`../../data/policies/${filename}`, import.meta.url);
  const content = readFileSync(fileUrl, "utf8").trim();

  return DocumentSchema.parse({ ...metadata, content });
});

export interface DocumentRepository {
  list(): Document[];
  findById(id: string): Document | undefined;
}

export const documentRepository: DocumentRepository = {
  list() {
    return documents.map((document) => ({ ...document }));
  },
  findById(id) {
    const document = documents.find((candidate) => candidate.id === id);
    return document ? { ...document } : undefined;
  },
};
