import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Document } from "@treasury-rag/contracts";

import { MarkdownDocumentParser } from "../domain/MarkdownDocumentParser.js";
import type { DocumentRepository } from "../ports/DocumentRepository.js";

/**
 * The corpus is an explicit, ordered list of files rather than a directory
 * scan: ingestion stays deterministic, and adding a policy is a visible
 * change. Metadata now lives in each file's frontmatter, so this list carries
 * filenames only and can no longer disagree with the documents themselves.
 */
const DOCUMENT_FILES = [
  "partialPayments.md",
  "partialPaymentsV1.md",
  "acmeApprovals.md",
  "borealApprovals.md",
  "acmeBankNotice.md",
  "borealWithholdings.md",
  "acmeSettlementWindows.md",
];

export class FileDocumentRepository implements DocumentRepository {
  private readonly documents: Document[];

  constructor(
    filenames: string[] = DOCUMENT_FILES,
    parser: MarkdownDocumentParser = new MarkdownDocumentParser(),
  ) {
    this.documents = filenames.map((filename) => {
      const fileUrl = new URL(
        `../../../data/policies/${filename}`,
        import.meta.url,
      );
      return parser.parse(readFileSync(fileUrl, "utf8"), fileURLToPath(fileUrl));
    });

    const duplicated = this.documents
      .map((document) => document.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    if (duplicated.length > 0) {
      throw new Error(
        `Duplicated document ids in the corpus: ${duplicated.join(", ")}`,
      );
    }
  }

  list(): Document[] {
    return this.documents.map((document) => ({ ...document }));
  }

  findById(id: string): Document | undefined {
    const document = this.documents.find((candidate) => candidate.id === id);
    return document ? { ...document } : undefined;
  }
}
