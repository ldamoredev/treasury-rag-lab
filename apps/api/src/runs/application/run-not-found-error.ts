export class RunNotFoundError extends Error {
  constructor(readonly runId: string) {
    super(`Run ${runId} was not found`);
    this.name = "RunNotFoundError";
  }
}
