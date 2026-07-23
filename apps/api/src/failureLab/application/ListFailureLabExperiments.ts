import {
  FailureLabExperimentListResponseSchema,
  type FailureLabExperimentListResponse,
} from "@treasury-rag/contracts";

import { failureLabExperiments } from "../domain/failureLabExperiments.js";

export class ListFailureLabExperiments {
  list(): FailureLabExperimentListResponse {
    return FailureLabExperimentListResponseSchema.parse({
      experiments: failureLabExperiments,
    });
  }
}
