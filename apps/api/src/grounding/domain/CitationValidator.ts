import type {
  GroundedAnswer,
  SearchResult,
  Tenant,
} from "@treasury-rag/contracts";

import { GroundingValidationError } from "./GroundingValidationError.js";

export class CitationValidator {
  validate(
    answer: GroundedAnswer,
    sources: SearchResult[],
    requestedTenant: Tenant,
  ): void {
    const sourcesById = new Map(
      sources.map((source) => [source.chunkId, source]),
    );

    for (const claim of answer.claims) {
      for (const citationId of claim.citationIds) {
        const source = sourcesById.get(citationId);
        if (!source) {
          throw new GroundingValidationError(
            `The generated answer cited an unknown source: ${citationId}`,
          );
        }

        if (source.tenant !== "global" && source.tenant !== requestedTenant) {
          throw new GroundingValidationError(
            `The generated answer cited source ${citationId} from tenant ${source.tenant}`,
          );
        }
      }
    }
  }
}
