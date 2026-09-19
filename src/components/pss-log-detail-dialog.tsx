"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  ShieldCheck,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PssApiLogDetail } from "@/lib/pss-log-types";

type PssLogDetailDialogProps = {
  /** Null closes the dialog; a new id refetches. */
  logId: string | null;
  onOpenChange: (open: boolean) => void;
};

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "break-all font-mono text-sm text-foreground"
            : "text-sm text-foreground"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/**
 * A JSON block with its own copy button.
 *
 * Copy is offered without qualification because everything on this screen has
 * already been redacted at write time - there is no unredacted version to leak.
 */
function JsonPanel({
  title,
  value,
  emptyLabel,
  /** More room for the panel people open this dialog to read. */
  tall = false,
}: {
  title: string;
  value: unknown;
  emptyLabel: string;
  tall?: boolean;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === "object" && Object.keys(value as object).length === 0);

  const text = isEmpty ? "" : JSON.stringify(value, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        variant: "destructive",
        title: "Could not copy",
        description: "Your browser blocked clipboard access.",
      });
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {!isEmpty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={copy}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <pre
          className={cn(
            "overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground",
            tall ? "max-h-[32rem]" : "max-h-72",
          )}
        >
          {text}
        </pre>
      )}
    </div>
  );
}

export default function PssLogDetailDialog({
  logId,
  onOpenChange,
}: PssLogDetailDialogProps) {
  const [log, setLog] = useState<PssApiLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logId) {
      setLog(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/admin/pss-logs/${logId}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "Could not load this API call.");
          return;
        }
        setLog(data.log);
      } catch {
        if (!cancelled) setError("Could not load this API call.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logId]);

  return (
    <Dialog open={!!logId} onOpenChange={onOpenChange}>
      {/* Let DialogContent do the scrolling - it is already a flex column with
          overflow-y-auto. Wrapping the body in its own scroller, or setting
          overflow-hidden here, only cancels that out. */}
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">API call detail</DialogTitle>
          <DialogDescription>
            The full request and response exchanged with PSS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {loading && (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {!loading && error && (
              <EmptyState
                icon={AlertTriangle}
                title="Could not load this record"
                description={error}
              />
            )}

            {!loading && !error && log && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={log.success ? "success" : "danger"}>
                    {log.success ? "Success" : "Failed"}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {log.method}
                  </Badge>
                  {log.statusCode !== null && (
                    <Badge variant="outline" className="font-mono">
                      {log.statusCode}
                    </Badge>
                  )}
                  {log.environment && (
                    <Badge variant="neutral">{log.environment}</Badge>
                  )}
                </div>

                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Service" value={log.serviceName} />
                  <Field
                    label="Timestamp"
                    value={new Date(log.createdAt).toLocaleString()}
                  />
                  <Field label="Duration" value={`${log.durationMs} ms`} />
                  <Field
                    label="Correlation ID"
                    value={log.correlationId}
                    mono
                  />
                  <div className="sm:col-span-2">
                    <Field label="Endpoint" value={log.endpoint} mono />
                  </div>
                </dl>

                {log.errorMessage && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                      Error
                    </p>
                    <p className="mt-1 break-words text-sm text-foreground">
                      {log.errorMessage}
                    </p>
                  </div>
                )}

                <div
                  className={cn(
                    "flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5",
                    "text-xs text-muted-foreground",
                  )}
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Credentials, tokens, PINs, CVVs and full card numbers are
                    removed before this record is written. What you see here is
                    what is stored — the original values were never saved.
                  </p>
                </div>

                {/* Grouped rather than listed flat, so "what did we send" and
                    "what did PSS answer" are two things to compare, not four
                    panels to scroll past. */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Request &mdash; sent to PSS
                    </h3>
                  </div>
                  <JsonPanel
                    title="Headers"
                    value={log.requestHeaders}
                    emptyLabel="No headers recorded."
                  />
                  <JsonPanel
                    title="Payload"
                    value={log.requestBody}
                    emptyLabel="No request body — this call sent none."
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Response &mdash; returned by PSS
                    </h3>
                  </div>
                  <JsonPanel
                    title="Payload"
                    value={log.responseBody}
                    emptyLabel="No response body — the request did not complete."
                    tall
                  />
                  <JsonPanel
                    title="Headers"
                    value={log.responseHeaders}
                    emptyLabel="No headers recorded."
                  />
                </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
