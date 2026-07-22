import { readFileSync } from "node:fs";

import { DocumentSchema, type Document } from "@treasury-rag/contracts";

import type { DocumentRepository } from "../ports/DocumentRepository.js";

type DocumentDefinition = Omit<Document, "content"> & {
  filename: string;
};

const DOCUMENTS: DocumentDefinition[] = [
  {
    id: "partial-payments",
    title: "Política global de pagos parciales",
    tenant: "global",
    version: 2,
    effectiveFrom: "2026-01-15",
    filename: "partialPayments.md",
  },
  {
    id: "acme-approvals",
    title: "Aprobaciones de tesorería — Acme",
    tenant: "acme",
    version: 1,
    effectiveFrom: "2026-02-01",
    filename: "acmeApprovals.md",
  },
  {
    id: "boreal-approvals",
    title: "Aprobaciones de tesorería — Boreal",
    tenant: "boreal",
    version: 1,
    effectiveFrom: "2026-02-01",
    filename: "borealApprovals.md",
  },
];

export class FileDocumentRepository implements DocumentRepository {
  private readonly documents: Document[];

  constructor(definitions: DocumentDefinition[] = DOCUMENTS) {
    this.documents = definitions.map(({ filename, ...metadata }) => {
      const fileUrl = new URL(
        `../../../data/policies/${filename}`,
        import.meta.url,
      );
      const content = readFileSync(fileUrl, "utf8").trim();
      return DocumentSchema.parse({ ...metadata, content });
    });
  }

  list(): Document[] {
    return this.documents.map((document) => ({ ...document }));
  }

  findById(id: string): Document | undefined {
    const document = this.documents.find((candidate) => candidate.id === id);
    return document ? { ...document } : undefined;
  }
}
