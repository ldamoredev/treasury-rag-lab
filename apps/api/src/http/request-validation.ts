import type { ZodType } from "zod";

import { InvalidHttpRequestError } from "./errors/invalid-http-request-error.js";

type RequestErrorDescriptor = {
  code: string;
  message: string;
};

export function parseHttpRequest<Output>(
  schema: ZodType<Output>,
  value: unknown,
  error: RequestErrorDescriptor,
): Output {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidHttpRequestError(
      error.code,
      error.message,
      parsed.error.issues,
    );
  }
  return parsed.data;
}
