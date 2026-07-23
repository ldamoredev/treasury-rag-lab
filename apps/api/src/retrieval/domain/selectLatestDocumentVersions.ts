import type { Document } from "@treasury-rag/contracts";

/**
 * Keeps only the current version of every policy family. Documents that share
 * a title are versions of the same policy; the current one is the highest
 * version, with the most recent effective date as tie-breaker.
 */
export function selectLatestDocumentVersions(
  documents: Document[],
): Document[] {
  const latestByTitle = new Map<string, Document>();

  for (const document of documents) {
    const current = latestByTitle.get(document.title);
    if (!current || isNewer(document, current)) {
      latestByTitle.set(document.title, document);
    }
  }

  return documents.filter(
    (document) => latestByTitle.get(document.title) === document,
  );
}

function isNewer(candidate: Document, current: Document): boolean {
  if (candidate.version !== current.version) {
    return candidate.version > current.version;
  }
  return candidate.effectiveFrom > current.effectiveFrom;
}
