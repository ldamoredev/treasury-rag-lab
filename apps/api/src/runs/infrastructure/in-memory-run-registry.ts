import type { Run } from "../domain/run.js";
import type { RunRegistry } from "../ports/run-registry.js";

export class InMemoryRunRegistry implements RunRegistry {
  private readonly runs = new Map<string, Run>();

  constructor(private readonly completedRunTtlMs = 5 * 60_000) {}

  save(run: Run): void {
    if (this.runs.has(run.id)) {
      throw new Error(`Run ${run.id} is already registered`);
    }
    this.runs.set(run.id, run);
  }

  find(runId: string): Run | undefined {
    return this.runs.get(runId);
  }

  retainTerminalRun(runId: string): void {
    const timeout = setTimeout(() => {
      this.runs.delete(runId);
    }, this.completedRunTtlMs);
    timeout.unref();
  }
}
