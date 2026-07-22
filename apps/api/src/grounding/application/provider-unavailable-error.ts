export class ProviderUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Grounded answer provider is unavailable", { cause });
    this.name = "ProviderUnavailableError";
  }
}
