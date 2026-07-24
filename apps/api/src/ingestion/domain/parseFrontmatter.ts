export type ParsedFrontmatter = {
  metadata: Record<string, string>;
  body: string;
};

const DELIMITER = "---";

/**
 * Reads a leading `---` block of flat `key: value` pairs and returns the body
 * separately, so every source offset in the rest of the pipeline is relative
 * to the document body and never shifts when metadata is edited.
 *
 * This is deliberately not a YAML parser. The corpus only stores scalars, and
 * the values are validated by the document schema right after parsing, so
 * pulling in a YAML dependency would add a transitive parser without adding a
 * guarantee.
 */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  if (!source.startsWith(`${DELIMITER}\n`)) {
    return { metadata: {}, body: source };
  }

  const closingIndex = source.indexOf(`\n${DELIMITER}\n`, DELIMITER.length);
  if (closingIndex === -1) {
    throw new Error("The frontmatter block is not terminated by ---");
  }

  const block = source.slice(DELIMITER.length + 1, closingIndex);
  const body = source.slice(closingIndex + DELIMITER.length + 2);
  const metadata: Record<string, string> = {};

  for (const line of block.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Frontmatter line is not a key/value pair: ${line}`);
    }
    const key = line.slice(0, separatorIndex).trim();
    if (key.length === 0) {
      throw new Error(`Frontmatter line is not a key/value pair: ${line}`);
    }
    metadata[key] = unquote(line.slice(separatorIndex + 1).trim());
  }

  return { metadata, body };
}

function unquote(value: string): string {
  const quoted = (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}
