"use client";

import { useCallback, useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { TERMS_EXTENSIONS, EMPTY_DOC } from "@/components/terms-content";

type ToolbarButtonProps = {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  label,
  icon: Icon,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-40",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link URL (http, https or mailto)", previous ?? "https://");

    // Cancelled - leave the document alone.
    if (input === null) return;

    const url = input.trim();

    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    if (!/^(https?:|mailto:)/i.test(url)) {
      window.alert("Links must start with http://, https:// or mailto:");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/40 px-2 py-1.5">
      <ToolbarButton
        label="Bold"
        icon={Bold}
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        icon={Italic}
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Underline"
        icon={UnderlineIcon}
        isActive={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="Strikethrough"
        icon={Strikethrough}
        isActive={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <Divider />

      <ToolbarButton
        label="Heading 1"
        icon={Heading1}
        isActive={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        label="Heading 2"
        icon={Heading2}
        isActive={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Heading 3"
        icon={Heading3}
        isActive={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Divider />

      <ToolbarButton
        label="Bulleted list"
        icon={List}
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Numbered list"
        icon={ListOrdered}
        isActive={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        icon={Quote}
        isActive={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Divider"
        icon={Minus}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <Divider />

      <ToolbarButton
        label="Add or edit link"
        icon={Link2}
        isActive={editor.isActive("link")}
        onClick={setLink}
      />
      <ToolbarButton
        label="Remove link"
        icon={Link2Off}
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />

      <Divider />

      <ToolbarButton
        label="Undo"
        icon={Undo2}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="Redo"
        icon={Redo2}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

type TermsEditorProps = {
  /** ProseMirror document currently being edited. */
  content: unknown;
  onChange: (doc: unknown) => void;
  /** Remounts the editor when the loaded draft changes. */
  documentKey?: string;
  disabled?: boolean;
};

export default function TermsEditor({
  content,
  onChange,
  documentKey,
  disabled,
}: TermsEditorProps) {
  const editor = useEditor(
    {
      extensions: TERMS_EXTENSIONS,
      content: (content as object) ?? EMPTY_DOC,
      editable: !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor: e }) => onChange(e.getJSON()),
      editorProps: {
        attributes: {
          class:
            "terms-prose min-h-[22rem] px-4 py-3 focus:outline-none",
          "aria-label": "Terms and Conditions content",
        },
      },
    },
    // Switching to a different draft must load that draft's document rather
    // than merge into whatever is open.
    [documentKey],
  );

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-background transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
