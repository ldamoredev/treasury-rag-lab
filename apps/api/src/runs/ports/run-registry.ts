import type { Run } from "../domain/run.js";

export interface RunRegistry {
  save(run: Run): void;
  find(runId: string): Run | undefined;
  retainTerminalRun(runId: string): void;
}
