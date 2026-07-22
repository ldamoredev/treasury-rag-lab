import { DocumentListResponseSchema } from "@treasury-rag/contracts";

import type { DocumentRepository } from "../ports/document-repository.js";

export class ListDocuments {
  constructor(private readonly documents: DocumentRepository) {}

  execute() {
    return DocumentListResponseSchema.parse({
      documents: this.documents.list().map(
        ({ content: _content, ...document }) => document,
      ),
    });
  }
}
