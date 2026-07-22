export class SemanticSearchUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Semantic search is unavailable", { cause });
    this.name = "SemanticSearchUnavailableError";
  }
}
