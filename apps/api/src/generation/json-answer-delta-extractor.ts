const ANSWER_FIELD = /"answer"\s*:\s*"/;

const ESCAPED_CHARACTERS: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/**
 * Extracts decoded characters from the top-level `answer` JSON string while
 * Anthropic is still streaming the structured output document.
 */
export class JsonAnswerDeltaExtractor {
  private buffer = "";
  private scanIndex: number | undefined;
  private escaped = false;
  private unicodeDigits: string | undefined;
  private pendingHighSurrogate = "";
  private complete = false;

  push(fragment: string): string {
    if (this.complete || fragment.length === 0) {
      return "";
    }

    this.buffer += fragment;

    if (this.scanIndex === undefined) {
      const match = ANSWER_FIELD.exec(this.buffer);
      if (!match) {
        return "";
      }

      this.scanIndex = match.index + match[0].length;
    }

    let decoded = "";

    while (this.scanIndex < this.buffer.length) {
      const character = this.buffer[this.scanIndex]!;
      this.scanIndex += 1;

      if (this.unicodeDigits !== undefined) {
        if (!/[0-9a-f]/i.test(character)) {
          throw new Error("Invalid Unicode escape in streamed JSON answer");
        }

        this.unicodeDigits += character;
        if (this.unicodeDigits.length === 4) {
          decoded += this.emitCodeUnit(
            String.fromCharCode(Number.parseInt(this.unicodeDigits, 16)),
          );
          this.unicodeDigits = undefined;
        }
        continue;
      }

      if (this.escaped) {
        this.escaped = false;
        if (character === "u") {
          this.unicodeDigits = "";
          continue;
        }

        const escapedCharacter = ESCAPED_CHARACTERS[character];
        if (escapedCharacter === undefined) {
          throw new Error("Invalid escape in streamed JSON answer");
        }
        decoded += this.emitCodeUnit(escapedCharacter);
        continue;
      }

      if (character === "\\") {
        this.escaped = true;
        continue;
      }

      if (character === '"') {
        this.complete = true;
        decoded += this.flushPendingSurrogate();
        break;
      }

      decoded += this.emitCodeUnit(character);
    }

    return decoded;
  }

  private emitCodeUnit(character: string): string {
    const code = character.charCodeAt(0);
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff;
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;

    if (isHighSurrogate) {
      const previous = this.flushPendingSurrogate();
      this.pendingHighSurrogate = character;
      return previous;
    }

    if (isLowSurrogate && this.pendingHighSurrogate) {
      const pair = this.pendingHighSurrogate + character;
      this.pendingHighSurrogate = "";
      return pair;
    }

    return this.flushPendingSurrogate() + character;
  }

  private flushPendingSurrogate(): string {
    const pending = this.pendingHighSurrogate;
    this.pendingHighSurrogate = "";
    return pending;
  }
}
