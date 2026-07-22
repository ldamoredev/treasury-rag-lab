export class InvalidHttpRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly issues: unknown[],
  ) {
    super(message);
    this.name = "InvalidHttpRequestError";
  }
}
