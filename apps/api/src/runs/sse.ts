import type { RunEvent } from "@treasury-rag/contracts";

export function serializeRunEvent(event: RunEvent): string {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    "",
    "",
  ].join("\n");
}

export function isTerminalRunEvent(event: RunEvent): boolean {
  return event.type === "run.completed" || event.type === "run.failed";
}
