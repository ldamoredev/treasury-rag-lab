import type { Document, Tenant } from "@treasury-rag/contracts";

type DocumentSelection = {
  tenant: Tenant;
  tenantFilterEnabled: boolean;
};

export function selectDocuments(
  documents: Document[],
  selection: DocumentSelection,
): Document[] {
  if (!selection.tenantFilterEnabled) {
    return documents;
  }

  return documents.filter((document) =>
    document.tenant === "global" || document.tenant === selection.tenant
  );
}
