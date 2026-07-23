export class FailureLabUnavailableError extends Error {
  constructor(readonly cause: unknown) {
    super("The failure lab is unavailable");
    this.name = "FailureLabUnavailableError";
  }
}
