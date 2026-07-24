import { DocumentSchema, type Document } from "@treasury-rag/contracts";

import { parseFrontmatter } from "../../ingestion/domain/parseFrontmatter.js";

/**
 * Turns one Markdown source file into a validated document. Metadata travels
 * inside the file instead of a parallel table in the repository, so a policy
 * cannot silently disagree with the tenant or version it is indexed under.
 *
 * `content` is the body only: source offsets stay relative to the body, and
 * editing metadata never shifts a chunk boundary or an existing citation.
 */
export class MarkdownDocumentParser {
  parse(source: string, origin: string): Document {
    const { metadata, body } = this.read(source, origin);
    const version = Number.parseInt(metadata.version ?? "", 10);

    const document = DocumentSchema.safeParse({
      id: metadata.id,
      title: metadata.title,
      tenant: metadata.tenant,
      version: Number.isNaN(version) ? metadata.version : version,
      effectiveFrom: metadata.effectiveFrom,
      content: body.trim(),
    });

    if (!document.success) {
      const fields = document.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid document metadata in ${origin} — ${fields}`);
    }

    return document.data;
  }

  private read(source: string, origin: string) {
    try {
      return parseFrontmatter(source);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new Error(`Invalid frontmatter in ${origin} — ${reason}`);
    }
  }
}
