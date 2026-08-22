"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { cn } from "@/lib/utils";

/**
 * The single schema for Terms & Conditions content. The editor and the
 * read-only renderer both build on it, which is what makes the Super Admin's
 * preview a true preview: the same extensions parse and render the document in
 * both places, so a requester cannot be shown something the author never saw.
 *
 * It doubles as the security boundary. Content is stored as a ProseMirror
 * document rather than HTML, and anything outside these nodes and marks is
 * dropped on the way in and never produced on the way out - so there is no
 * path for markup or script to reach a requester's browser.
 */
export const TERMS_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
    link: {
      openOnClick: false,
      // Explicit allowlist: no javascript:, data:, or other executable schemes.
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      },
    },
  }),
];

/** An empty ProseMirror document, used to seed a brand new draft. */
export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function isEmptyDoc(doc: unknown): boolean {
  const content = (doc as { content?: unknown[] } | null)?.content;
  if (!Array.isArray(content) || content.length === 0) return true;
  return content.every(
    (node) =>
      (node as { type?: string })?.type === "paragraph" &&
      !(node as { content?: unknown[] })?.content?.length,
  );
}

type TermsContentProps = {
  content: unknown;
  className?: string;
};

/**
 * Renders a stored terms document read-only. Used for the Super Admin preview,
 * the version history viewer, and the agreement block requesters read - one
 * component, so all three are the same by construction.
 */
export default function TermsContent({ content, className }: TermsContentProps) {
  const editor = useEditor({
    extensions: TERMS_EXTENSIONS,
    content: (content as object) ?? EMPTY_DOC,
    editable: false,
    // Next renders this on the server first; ProseMirror needs a real DOM.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "terms-prose focus:outline-none" },
    },
  });

  // Keep the preview in step with the editor as the author types.
  useEffect(() => {
    if (!editor) return;
    const next = (content as object) ?? EMPTY_DOC;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) {
    return (
      <div className={cn("space-y-3", className)} aria-hidden="true">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    );
  }

  return <EditorContent editor={editor} className={className} />;
}
