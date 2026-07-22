import type {
  SearchRequest,
  SearchResponse,
} from "@treasury-rag/contracts";

export interface PolicySearch {
  search(request: SearchRequest): Promise<SearchResponse>;
}
