"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  FilePlus2,
  FileText,
  Loader2,
  PenLine,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import TermsEditor from "@/components/terms-editor";
import TermsContent, { EMPTY_DOC, isEmptyDoc } from "@/components/terms-content";

type TermsStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type TermsVersionRow = {
  id: string;
  version: number | null;
  title: string;
  content: unknown;
  status: TermsStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { acceptances: number };
};

/** What the editor pane is currently holding. */
type EditorState = {
  /** null while the draft has never been saved. */
  id: string | null;
  title: string;
  content: unknown;
};

const BLANK: EditorState = { id: null, title: "", content: EMPTY_DOC };

export default function AdminTermsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<TermsVersionRow[]>([]);
  const [editor, setEditor] = useState<EditorState>(BLANK);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("edit");

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TermsVersionRow | null>(null);
  const [viewing, setViewing] = useState<TermsVersionRow | null>(null);

  const published = versions.find((v) => v.status === "PUBLISHED") ?? null;
  const openDraft = editor.id
    ? versions.find((v) => v.id === editor.id) ?? null
    : null;

  const load = useCallback(
    async (opts: { adoptDraft?: boolean } = {}) => {
      try {
        const res = await fetch("/api/admin/terms");
        const data = await res.json();

        if (!res.ok) {
          toast({
            variant: "destructive",
            title: "Error",
            description: data.error || "Failed to load Terms & Conditions",
          });
          return;
        }

        const rows: TermsVersionRow[] = data.versions || [];
        setVersions(rows);

        // On first load, drop straight into the outstanding draft if there is
        // one - that is almost always what the admin came back for.
        if (opts.adoptDraft) {
          const draft = rows.find((v) => v.status === "DRAFT");
          if (draft) {
            setEditor({ id: draft.id, title: draft.title, content: draft.content });
            setDirty(false);
          }
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "An unexpected error occurred",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load({ adoptDraft: true });
  }, [load]);

  /** Persists the open draft and returns its id, or null when it failed. */
  async function persistDraft(): Promise<string | null> {
    const title = editor.title.trim();

    if (!title) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Give these Terms & Conditions a title before saving.",
      });
      return null;
    }

    if (isEmptyDoc(editor.content)) {
      toast({
        variant: "destructive",
        title: "Nothing to save",
        description: "Write the Terms & Conditions before saving.",
      });
      return null;
    }

    const isNew = !editor.id;
    const res = await fetch(
      isNew ? "/api/admin/terms" : `/api/admin/terms/${editor.id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: editor.content }),
      },
    );
    const data = await res.json();

    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Not saved",
        description: data.error || "Failed to save the draft",
      });
      return null;
    }

    return data.terms.id as string;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const id = await persistDraft();
      if (!id) return;

      setEditor((e) => ({ ...e, id }));
      setDirty(false);
      await load();
      toast({
        title: "Draft saved",
        description: "This draft is not visible to requesters until published.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      // Publish always ships what is on screen, so save first rather than
      // quietly putting an older saved copy into force.
      const id = await persistDraft();
      if (!id) return;

      const res = await fetch(`/api/admin/terms/${id}/publish`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Not published",
          description: data.error || "Failed to publish",
        });
        return;
      }

      setEditor(BLANK);
      setDirty(false);
      setTab("edit");
      await load();
      toast({
        title: `Version ${data.terms.version} published`,
        description:
          "New card requests will now show and require these Terms & Conditions.",
      });
    } finally {
      setPublishing(false);
      setConfirmPublish(false);
    }
  }

  async function handleDelete(row: TermsVersionRow) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/terms/${row.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Not deleted",
          description: data.error || "Failed to delete the draft",
        });
        return;
      }

      if (editor.id === row.id) {
        setEditor(BLANK);
        setDirty(false);
      }
      await load();
      toast({ title: "Draft deleted" });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  function editDraft(row: TermsVersionRow) {
    setEditor({ id: row.id, title: row.title, content: row.content });
    setDirty(false);
    setTab("edit");
  }

  function duplicateToDraft(row: TermsVersionRow) {
    setEditor({
      id: null,
      title: `${row.title} (revised)`,
      content: row.content,
    });
    setDirty(true);
    setTab("edit");
    toast({
      title: "Copied into a new draft",
      description: "Save it when you are ready; publishing replaces the current version.",
    });
  }

  const busy = saving || publishing;
  const canSubmit = editor.title.trim().length > 0 && !isEmptyDoc(editor.content);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Terms & Conditions"
        description="Author the agreement requesters must accept before submitting a card request. Publishing a version puts it into force immediately for every new request."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setEditor(BLANK);
              setDirty(false);
              setTab("edit");
            }}
            disabled={busy}
          >
            <FilePlus2 />
            New draft
          </Button>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* What is in force right now                                     */}
      {/* ------------------------------------------------------------- */}
      {published ? (
        <div className="flex animate-fade-in-up flex-col gap-3 rounded-xl border border-success/25 bg-success-muted p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-success-muted-foreground">
                Version {published.version} is live
              </p>
              <p className="text-sm text-success-muted-foreground/90">
                <span className="font-medium">{published.title}</span>
                {published.publishedAt
                  ? ` · published ${new Date(published.publishedAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-success-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="font-semibold tabular-nums">
                {published._count.acceptances}
              </span>
              accepted
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewing(published)}
            >
              <Eye />
              View
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex animate-fade-in-up items-start gap-3 rounded-xl border border-warning/25 bg-warning-muted p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-warning-muted-foreground">
              No Terms &amp; Conditions published
            </p>
            <p className="text-sm leading-relaxed text-warning-muted-foreground/90">
              Card requests are being accepted without an agreement. Write and
              publish a version below to start requiring acceptance.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Author                                                         */}
      {/* ------------------------------------------------------------- */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
                <PenLine className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <CardTitle>
                  {editor.id ? "Edit draft" : "New draft"}
                </CardTitle>
                <CardDescription>
                  Drafts are private. Nothing reaches requesters until you
                  publish.
                </CardDescription>
              </div>
            </div>
            {dirty && (
              <span className="rounded-full bg-warning-muted px-2.5 py-0.5 text-xs font-medium text-warning-muted-foreground">
                Unsaved changes
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="termsTitle">Title</Label>
            <Input
              id="termsTitle"
              value={editor.title}
              disabled={busy}
              placeholder="e.g. Prepaid Card Terms &amp; Conditions"
              className="max-w-xl"
              onChange={(e) => {
                setEditor((s) => ({ ...s, title: e.target.value }));
                setDirty(true);
              }}
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="edit">
                <PenLine className="h-4 w-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-4">
              <TermsEditor
                documentKey={editor.id ?? "new"}
                content={editor.content}
                disabled={busy}
                onChange={(doc) => {
                  setEditor((s) => ({ ...s, content: doc }));
                  setDirty(true);
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Supports headings, bold, italic, underline, strikethrough,
                lists, quotes, dividers and links.
              </p>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Exactly how requesters will see it
                </p>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {editor.title.trim() || "Untitled Terms & Conditions"}
                    </span>
                  </div>
                  {isEmptyDoc(editor.content) ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing written yet.
                    </p>
                  ) : (
                    <TermsContent content={editor.content} />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            {openDraft && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                disabled={busy}
                onClick={() => setConfirmDelete(openDraft)}
              >
                <Trash2 />
                Discard draft
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy || !canSubmit}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving&hellip;
                </>
              ) : (
                <>
                  <Save />
                  Save draft
                </>
              )}
            </Button>
            <Button
              type="button"
              disabled={busy || !canSubmit}
              onClick={() => setConfirmPublish(true)}
            >
              {publishing ? (
                <>
                  <Loader2 className="animate-spin" />
                  Publishing&hellip;
                </>
              ) : (
                <>
                  <Send />
                  Publish
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* History                                                        */}
      {/* ------------------------------------------------------------- */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <CardTitle>Version history</CardTitle>
              <CardDescription>
                Published versions are kept permanently — they are the record of
                what each requester agreed to.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            {versions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No versions yet"
                description="Write your first Terms & Conditions above and publish it."
                compact
              />
            ) : (
              <Table containerClassName="overflow-x-auto">
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="w-24">Version</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-44">Published</TableHead>
                    <TableHead className="w-28 text-right">Accepted</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {row.version !== null ? `v${row.version}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium">
                        {row.title}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.publishedAt
                          ? new Date(row.publishedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row._count.acceptances}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewing(row)}
                          >
                            <Eye />
                            View
                          </Button>
                          {row.status === "DRAFT" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => editDraft(row)}
                              >
                                <PenLine />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                                disabled={busy}
                                onClick={() => setConfirmDelete(row)}
                              >
                                <Trash2 />
                                Delete
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => duplicateToDraft(row)}
                            >
                              <Copy />
                              Revise
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Dialogs                                                        */}
      {/* ------------------------------------------------------------- */}
      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish these Terms &amp; Conditions?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">
                    {editor.title.trim() || "Untitled"}
                  </span>{" "}
                  becomes the agreement every new card request must accept,
                  immediately.
                </p>
                {published && (
                  <p>
                    Version {published.version} will be archived. Requests
                    already submitted against it keep their record.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handlePublish();
              }}
              disabled={publishing}
            >
              {publishing ? (
                <>
                  <Loader2 className="animate-spin" />
                  Publishing&hellip;
                </>
              ) : (
                "Publish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmDelete?.title}” will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) void handleDelete(confirmDelete);
              }}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting&hellip;
                </>
              ) : (
                "Delete draft"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              {viewing?.version !== null && viewing?.version !== undefined
                ? `Version ${viewing.version}`
                : "Draft"}
              {viewing?.publishedAt
                ? ` · published ${new Date(viewing.publishedAt).toLocaleString()}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
            {viewing ? <TermsContent content={viewing.content} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
