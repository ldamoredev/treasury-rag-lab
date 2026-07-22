export class DocumentNotFoundError extends Error {
  constructor(readonly documentId: string) {
    super(`Document ${documentId} was not found`);
    this.name = "DocumentNotFoundError";
  }
}
