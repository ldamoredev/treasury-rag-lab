import type { ErrorRequestHandler } from "express";

import { mapErrorToHttp } from "./httpErrorMapper.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  const mapped = mapErrorToHttp(error);
  if (mapped.status >= 500) {
    console.error("HTTP request failed", error);
  }
  response.status(mapped.status).json(mapped.body);
};
