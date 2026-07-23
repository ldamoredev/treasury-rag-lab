export class ExperimentNotFoundError extends Error {
  constructor(readonly experimentId: string) {
    super(`Experiment ${experimentId} was not found`);
    this.name = "ExperimentNotFoundError";
  }
}
