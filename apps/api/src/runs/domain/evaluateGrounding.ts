import type { GroundedAnswerResponse } from "@treasury-rag/contracts";

export function evaluateGrounding(response: GroundedAnswerResponse) {
  const sourceIds = new Set(
    response.sources.map((source) => source.chunkId),
  );
  const citations = response.claims.flatMap((claim) => claim.citationIds);

  return {
    citationValidity: citations.every((citationId) =>
      sourceIds.has(citationId)
    ),
    tenantLeakage: response.sources.some(
      (source) =>
        source.tenant !== "global" && source.tenant !== response.tenant,
    ),
  };
}
