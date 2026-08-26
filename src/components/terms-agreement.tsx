"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import TermsContent from "@/components/terms-content";
import { cn } from "@/lib/utils";

export type PublishedTerms = {
  id: string;
  version: number | null;
  title: string;
  content: unknown;
  publishedAt: string | null;
};

/**
 * "none" (nothing is published) and "failed" (we could not find out) both mean
 * no terms are on screen, but they must not be treated the same: skipping a
 * step because nothing is published is correct, skipping it because the fetch
 * broke would let someone through a gate that was never opened.
 */
export type TermsStatus = "loading" | "ready" | "none" | "failed";

type TermsAgreementProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  /**
   * Reports the document that was displayed so the submitter can echo its
   * version back. Not shown to the reader - the server still rejects an
   * agreement to a version that has since been superseded.
   */
  onTermsLoaded?: (terms: PublishedTerms | null) => void;
  /** Distinguishes "nothing published" from "could not load". */
  onStatusChange?: (status: TermsStatus) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * The terms in force plus the explicit agreement checkbox, shown before a card
 * request can be submitted. Rendered through the same TermsContent component
 * the Super Admin previews with, so requesters see exactly what was approved.
 */
export default function TermsAgreement({
  accepted,
  onAcceptedChange,
  onTermsLoaded,
  onStatusChange,
  disabled,
  className,
}: TermsAgreementProps) {
  const [terms, setTerms] = useState<PublishedTerms | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/terms/published");
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setFailed(true);
          onTermsLoaded?.(null);
          onStatusChange?.("failed");
          return;
        }

        setTerms(data.terms ?? null);
        onTermsLoaded?.(data.terms ?? null);
        onStatusChange?.(data.terms ? "ready" : "none");
      } catch {
        if (!cancelled) {
          setFailed(true);
          onTermsLoaded?.(null);
          onStatusChange?.("failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // Loaded once per form; the version is pinned for this submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-5 w-64" />
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive-muted p-3 text-sm text-destructive-muted-foreground",
          className,
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The Terms &amp; Conditions could not be loaded. Please reload the page
          before submitting a request.
        </p>
      </div>
    );
  }

  // Nothing published yet - there is nothing to agree to, so the form proceeds
  // as it did before terms existed rather than blocking every card request.
  if (!terms) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Title and content only. The version is still pinned to the submission
          and recorded against the request - it is simply not something the
          reader needs on screen. */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {terms.title}
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
        <TermsContent content={terms.content} />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
        <Checkbox
          id="acceptTerms"
          checked={accepted}
          disabled={disabled}
          onCheckedChange={(v) => onAcceptedChange(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="acceptTerms"
          className="cursor-pointer text-sm font-normal leading-relaxed text-foreground"
        >
          I have read and agree to the Terms &amp; Conditions.
        </Label>
      </div>
    </div>
  );
}
