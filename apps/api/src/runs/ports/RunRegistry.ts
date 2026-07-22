import type { Run } from "../domain/RunAggregate.js";

export interface RunRegistry {
  save(run: Run): void;
  find(runId: string): Run | undefined;
  retainTerminalRun(runId: string): void;
}
