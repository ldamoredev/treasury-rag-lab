import type {
  GroundedAnswerResponse,
  SearchResult,
  Tenant,
} from "@treasury-rag/contracts";

type GroundingEvidence = Pick<
  GroundedAnswerResponse,
  "claims" | "sources" | "tenant"
> & {
  allowedTenants?: readonly Tenant[];
};

export type GroundingEvaluation = {
  citationValidity: boolean;
  tenantLeakage: boolean;
  invalidCitationIds: string[];
  leakedSources: SearchResult[];
};

export function evaluateGrounding(
  evidence: GroundingEvidence,
): GroundingEvaluation {
  const sourceIds = new Set(
    evidence.sources.map((source) => source.chunkId),
  );
  const citations = evidence.claims.flatMap((claim) => claim.citationIds);
  const permittedTenants: readonly Tenant[] = evidence.allowedTenants
    ?? [evidence.tenant];

  const invalidCitationIds = citations.filter(
    (citationId) => !sourceIds.has(citationId),
  );
  const leakedSources = evidence.sources.filter(
    (source) =>
      source.tenant !== "global" && !permittedTenants.includes(source.tenant),
  );

  return {
    citationValidity: invalidCitationIds.length === 0,
    tenantLeakage: leakedSources.length > 0,
    invalidCitationIds,
    leakedSources,
  };
}
