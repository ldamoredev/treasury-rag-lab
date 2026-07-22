import type { RequestHandler } from "express";

import type { ListDocuments } from "../../documents/application/list-documents.js";

export class DocumentsController {
  constructor(private readonly listDocuments: ListDocuments) {}

  readonly handle: RequestHandler = (_request, response) => {
    response.status(200).json(this.listDocuments.execute());
  };
}
