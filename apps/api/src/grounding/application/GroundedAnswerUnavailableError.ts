export class GroundedAnswerUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Grounded answer generation is unavailable", { cause });
    this.name = "GroundedAnswerUnavailableError";
  }
}
