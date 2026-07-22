import type { Document } from "@treasury-rag/contracts";

export interface DocumentRepository {
  list(): Document[];
  findById(id: string): Document | undefined;
}
