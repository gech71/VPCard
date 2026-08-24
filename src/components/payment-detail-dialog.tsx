"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import type { PaymentDetail, PaymentEvent } from "@/lib/payment-history";

type PaymentDetailDialogProps = {
  /** Null closes the dialog; a new id refetches. */
  paymentId: string | null;
  onOpenChange: (open: boolean) => void;
};

/** Colour-codes an event so the failure in a long trail is the one that stands out. */
function eventTone(action: string) {
  if (action.includes("CONFIRMED")) return "success" as const;
  if (action.includes("FAILED")) return "danger" as const;
  if (action.includes("INITIATE")) return "info" as const;
  return "neutral" as const;
}

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
 * Everything recorded about one fee payment, including the audit events behind
 * it. A status alone rarely settles a Guest's question about their money; the
 * trail says whether the bank was even asked, what it answered, and when.
 */
export default function PaymentDetailDialog({
  paymentId,
  onOpenChange,
}: PaymentDetailDialogProps) {
  const { toast } = useToast();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!paymentId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setPayment(null);
      setEvents([]);

      try {
        const res = await fetch(`/api/admin/payments/${paymentId}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to load the payment");
        if (cancelled) return;

        setPayment(data.payment);
        setEvents(data.events ?? []);
      } catch (error) {
        if (cancelled) return;
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to load the payment",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [paymentId, toast]);

  return (
    <Dialog open={Boolean(paymentId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment detail</DialogTitle>
          <DialogDescription>
            The full record of one card-request fee payment and its audit trail.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payment…
          </div>
        ) : !payment ? (
          <EmptyState
            title="Payment unavailable"
            description="This payment could not be loaded."
            compact
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <StatusBadge status={payment.status} withIcon />
              <span className="font-mono text-xl font-bold tabular-nums text-foreground">
                {payment.amount.toFixed(2)} {payment.currency}
              </span>
              {payment.cardRequest ? (
                <Badge variant="success">Used for a card request</Badge>
              ) : payment.status === "SUCCESS" ? (
                <Badge variant="warning">Paid, not used yet</Badge>
              ) : null}
              {!payment.hasPaymentToken && (
                <Badge variant="neutral">No token was issued</Badge>
              )}
            </div>

            {payment.failureReason && (
              <p className="rounded-lg border border-destructive/25 bg-destructive-muted p-3 text-sm text-destructive-muted-foreground">
                {payment.failureReason}
              </p>
            )}

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Guest phone" value={payment.phoneNumber} mono />
              <Field
                label="Paid by"
                value={payment.paidByNumber ?? "—"}
                mono
              />
              <Field
                label="Our transaction id"
                value={payment.transactionId}
                mono
              />
              <Field
                label="Bank reference"
                value={payment.txnRef ?? "—"}
                mono
              />
              <Field
                label="Bank reported amount"
                value={payment.paidAmount ?? "—"}
                mono
              />
              <Field
                label="Started"
                value={new Date(payment.createdAt).toLocaleString()}
              />
              <Field
                label="Paid at"
                value={
                  payment.paidAt
                    ? new Date(payment.paidAt).toLocaleString()
                    : "—"
                }
              />
              <Field
                label="Last updated"
                value={new Date(payment.updatedAt).toLocaleString()}
              />
            </dl>

            {payment.cardRequest && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Card request paid for
                  </h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/admin/requests?accountNumber=${encodeURIComponent(
                        payment.cardRequest.accountNumber,
                      )}`}
                    >
                      <ExternalLink />
                      Open request
                    </Link>
                  </Button>
                </div>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Customer"
                    value={payment.cardRequest.customerName}
                  />
                  <Field
                    label="Status"
                    value={<StatusBadge status={payment.cardRequest.status} />}
                  />
                  <Field
                    label="Account number"
                    value={payment.cardRequest.accountNumber}
                    mono
                  />
                  <Field
                    label="Card program"
                    value={payment.cardRequest.cardProgramName ?? "—"}
                  />
                </dl>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Audit trail
              </h3>

              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No audit events were recorded for this payment.
                </p>
              ) : (
                <ol className="space-y-3 border-l border-border pl-4">
                  {events.map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[1.3125rem] top-1.5 h-2 w-2 rounded-full bg-border ring-4 ring-background"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={eventTone(event.action)}>
                          {event.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {event.actorEmail || event.actorId || event.actorType}
                        </span>
                      </div>
                      {event.details && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-muted/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
