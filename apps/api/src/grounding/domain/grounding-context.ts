import type { SearchResult, Tenant } from "@treasury-rag/contracts";

export type GroundingContext = {
  query: string;
  tenant: Tenant;
  sources: SearchResult[];
};
