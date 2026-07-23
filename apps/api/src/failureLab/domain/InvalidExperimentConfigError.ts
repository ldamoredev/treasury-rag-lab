export class InvalidExperimentConfigError extends Error {
  constructor(readonly changedVariables: string[]) {
    super(
      changedVariables.length === 0
        ? "An experiment must change exactly one variable; baseline and variant are identical"
        : `An experiment must change exactly one variable; changed: ${changedVariables.join(", ")}`,
    );
    this.name = "InvalidExperimentConfigError";
  }
}
