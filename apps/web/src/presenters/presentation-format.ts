import type { Tenant } from "@treasury-rag/contracts";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado";
}

export function tenantLabel(tenant: Tenant): string {
  switch (tenant) {
    case "global":
      return "Global";
    case "acme":
      return "Acme";
    case "boreal":
      return "Boreal";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
