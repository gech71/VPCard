import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

/**
 * The node and mark types the Terms editor can produce, mirroring the
 * TERMS_EXTENSIONS configuration in components/terms-content.tsx.
 *
 * Enforcing the list here as well as in the editor matters for two reasons: an
 * unknown node type would throw inside the requester's renderer rather than
 * being ignored, and the API is reachable directly, not only through the
 * editor UI.
 */
const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
]);

const ALLOWED_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);

const ALLOWED_LINK_PROTOCOL = /^(https?:|mailto:)/i;

/** Depth cap - a pathologically nested document would blow the render stack. */
const MAX_DEPTH = 20;

type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Walks a stored document and rejects anything the read-only renderer could not
 * safely display. Complements TipTap's own href guard, which blanks a
 * disallowed link at render time.
 */
export function validateTermsDoc(doc: unknown): ValidationResult {
  const root = doc as { type?: string } | null;

  if (!root || root.type !== "doc") {
    return { ok: false, error: "Content must be a document" };
  }

  function walk(node: unknown, depth: number): ValidationResult {
    if (depth > MAX_DEPTH) {
      return { ok: false, error: "Content is nested too deeply" };
    }

    const n = node as {
      type?: string;
      content?: unknown[];
      marks?: { type?: string; attrs?: { href?: unknown } }[];
    } | null;

    if (!n || typeof n.type !== "string" || !ALLOWED_NODES.has(n.type)) {
      return {
        ok: false,
        error: `Unsupported content block: ${n?.type ?? "unknown"}`,
      };
    }

    for (const mark of n.marks ?? []) {
      if (!mark?.type || !ALLOWED_MARKS.has(mark.type)) {
        return {
          ok: false,
          error: `Unsupported formatting: ${mark?.type ?? "unknown"}`,
        };
      }

      if (mark.type === "link") {
        const href = mark.attrs?.href;
        if (typeof href !== "string" || !ALLOWED_LINK_PROTOCOL.test(href)) {
          return {
            ok: false,
            error: "Links must start with http://, https:// or mailto:",
          };
        }
      }
    }

    for (const child of n.content ?? []) {
      const result = walk(child, depth + 1);
      if (!result.ok) return result;
    }

    return { ok: true };
  }

  return walk(doc, 0);
}

/** Shape handed to the requester-facing agreement block and the admin preview. */
export type PublishedTerms = {
  id: string;
  version: number | null;
  title: string;
  content: Prisma.JsonValue;
  publishedAt: Date | null;
};

/**
 * The one set of terms currently in force. Everything that needs to show,
 * enforce, or record an agreement reads it from here, so the requester, the
 * API that validates their submission, and the acceptance record can never
 * disagree about which version was in force.
 */
export async function getPublishedTerms(): Promise<PublishedTerms | null> {
  return prisma.termsVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      version: true,
      title: true,
      content: true,
      publishedAt: true,
    },
  });
}

/**
 * Rejects a card request whose submitter did not agree to the terms in force.
 *
 * Returns the columns to persist on the request. When nothing is published
 * there is nothing to agree to, so submission proceeds and the acceptance
 * columns stay null - that keeps card requests working in the window before a
 * Super Admin has authored any terms, rather than locking the product out.
 */
export async function resolveTermsAcceptance(input: {
  termsAccepted?: boolean;
  termsVersionId?: string;
}):
  | Promise<
      | { ok: true; data: { termsVersionId: string | null; termsVersionNo: number | null; termsAcceptedAt: Date | null } }
      | { ok: false; error: string }
    > {
  const published = await getPublishedTerms();

  if (!published) {
    return {
      ok: true,
      data: { termsVersionId: null, termsVersionNo: null, termsAcceptedAt: null },
    };
  }

  if (input.termsAccepted !== true) {
    return {
      ok: false,
      error: "You must accept the Terms & Conditions to submit a card request",
    };
  }

  // Guards against agreeing to terms that were superseded while the form sat
  // open: the client must echo back the version it actually displayed.
  if (input.termsVersionId !== published.id) {
    return {
      ok: false,
      error:
        "The Terms & Conditions have been updated. Please reload and review the current version before submitting.",
    };
  }

  return {
    ok: true,
    data: {
      termsVersionId: published.id,
      termsVersionNo: published.version,
      // Server clock, never the client's - this is the record of record.
      termsAcceptedAt: new Date(),
    },
  };
}
