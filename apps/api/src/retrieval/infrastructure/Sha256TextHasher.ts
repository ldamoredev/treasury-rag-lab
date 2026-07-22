import { createHash } from "node:crypto";

import type { TextHasher } from "../ports/TextHasher.js";

export class Sha256TextHasher implements TextHasher {
  hash(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
  }
}
