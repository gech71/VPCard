"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Receipt,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getSuperAppChannel,
  sendPaymentToken,
  waitForSuperAppChannel,
} from "@/lib/superapp-channel";

type Phase =
  | "idle"
  | "requesting"
  | "connecting"
  | "awaiting"
  | "success"
  | "failed";

type CardRequestPaymentProps = {
  amount: number;
  currency: string;
  /** Handed back once the bank confirms, to be sent with the card request. */
  onPaid: (transactionId: string) => void;
  className?: string;
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * The Guest payment screen: steps 3 and 4 of the MiniApp integration.
 *
 * Step 3 happens on the server (the amount is read from the Super Admin
 * configuration there, never sent from here). This component hands the returned
 * payment token to the Super App over window.myJsChannel and then polls our own
 * server until the bank confirms - the browser never decides that a payment
 * succeeded.
 */
export default function CardRequestPayment({
  amount,
  currency,
  onPaid,
  className,
}: CardRequestPaymentProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);

  // A payment opened with the bank whose token never reached the Super App.
  // Retrying delivers *this* token rather than opening a second transaction -
  // the first one was never handed to anybody, so there is nothing to replace.
  const undelivered = useRef<{ transactionId: string; paymentToken: string } | null>(
    null,
  );

  // Grab the channel as early as we can, and again whenever the WebView brings
  // this page back to the front: after the Super App's payment sheet closes the
  // host reloads and re-injects it, and the sighting is what gets remembered.
  useEffect(() => {
    getSuperAppChannel();

    const recapture = () => void getSuperAppChannel();

    window.addEventListener("pageshow", recapture);
    window.addEventListener("focus", recapture);
    document.addEventListener("visibilitychange", recapture);

    return () => {
      window.removeEventListener("pageshow", recapture);
      window.removeEventListener("focus", recapture);
      document.removeEventListener("visibilitychange", recapture);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(
    async (transactionId: string) => {
      try {
        const res = await fetch(
          `/api/payments/card-request/status?transactionId=${encodeURIComponent(transactionId)}`,
        );
        const data = await res.json();

        if (res.ok && data.status === "SUCCESS") {
          stopPolling();
          setPhase("success");
          onPaid(transactionId);
          return;
        }

        if (res.ok && (data.status === "FAILED" || data.status === "CANCELLED")) {
          stopPolling();
          setPhase("failed");
          setError("The payment did not go through. You can try again.");
          return;
        }

        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          stopPolling();
          setPhase("failed");
          setError(
            "We are still waiting for confirmation. If you were charged, reopen this page shortly — your payment will be picked up.",
          );
          return;
        }

        pollTimer.current = setTimeout(() => void poll(transactionId), POLL_INTERVAL_MS);
      } catch {
        pollTimer.current = setTimeout(() => void poll(transactionId), POLL_INTERVAL_MS);
      }
    },
    [onPaid, stopPolling],
  );

  /**
   * Step 4: hand the payment token to the Super App and start polling.
   *
   * The channel is waited for rather than tested once. The Super App reloads
   * this WebView when its payment sheet closes and injects the channel again
   * shortly after the document loads, so a Guest who cancels a payment and
   * immediately tries a second one can otherwise click Pay inside the gap and
   * be told, wrongly, to reopen the mini app.
   */
  async function handOff(transactionId: string, paymentToken: string) {
    setPhase("connecting");

    const channel = await waitForSuperAppChannel();

    if (!channel || !sendPaymentToken(channel, paymentToken)) {
      // Keep the token: the bank has already opened this transaction and
      // nothing has consumed it, so the next attempt should deliver it rather
      // than open another one.
      undelivered.current = { transactionId, paymentToken };
      setPhase("failed");
      setError(
        "Could not reach the NIBtera payment app. Please open this page from the NIBtera app and try again.",
      );
      return;
    }

    undelivered.current = null;
    setPhase("awaiting");
    startedAt.current = Date.now();
    pollTimer.current = setTimeout(
      () => void poll(transactionId),
      POLL_INTERVAL_MS,
    );
  }

  async function handlePay() {
    setError(null);

    // Retry of a handoff that failed: deliver the token we already hold.
    const pending = undelivered.current;

    if (pending) {
      try {
        await handOff(pending.transactionId, pending.paymentToken);
      } catch {
        setPhase("failed");
        setError("An unexpected error occurred. Please try again.");
      }
      return;
    }

    setPhase("requesting");

    try {
      const res = await fetch("/api/payments/card-request/initiate", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setPhase("failed");
        setError(data.error || "Could not start the payment.");
        return;
      }

      // A payment made earlier and never spent - nothing more to do.
      if (data.alreadyPaid) {
        setPhase("success");
        onPaid(data.transactionId);
        return;
      }

      await handOff(data.transactionId, data.paymentToken);
    } catch {
      setPhase("failed");
      setError("An unexpected error occurred. Please try again.");
    }
  }

  if (phase === "success") {
    return (
      <div
        className={cn(
          "flex animate-scale-in flex-col items-center gap-3 rounded-xl border border-success/25 bg-success-muted p-6 text-center",
          className,
        )}
      >
        <span className="flex h-12 w-12 animate-check-pop items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-success-muted-foreground">
            Payment confirmed
          </p>
          <p className="text-sm text-success-muted-foreground/90">
            You can now continue with your card request.
          </p>
        </div>
      </div>
    );
  }

  const busy =
    phase === "requesting" || phase === "connecting" || phase === "awaiting";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border bg-muted/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">Card request fee</p>
            <p className="text-sm text-muted-foreground">
              A one-off fee is required for this card request.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4 shrink-0" />
              Card request fee
            </dt>
            <dd className="font-mono text-sm tabular-nums text-foreground">
              {amount.toFixed(2)} {currency}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <dt className="text-sm font-semibold text-foreground">Amount to pay</dt>
            <dd className="font-mono text-xl font-bold tabular-nums text-foreground">
              {amount.toFixed(2)} {currency}
            </dd>
          </div>
        </dl>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
            <Smartphone className="h-4 w-4" />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Pay with your NIB account
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You will confirm this payment in the NIBtera app.
            </p>
          </div>
        </div>

        {(phase === "connecting" || phase === "awaiting") && (
          <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-muted p-3 text-sm text-info-muted-foreground">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <p>
              {phase === "connecting"
                ? "Opening the NIBtera payment app…"
                : "Waiting for your confirmation in the NIBtera app. Keep this page open."}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive-muted p-3 text-sm text-destructive-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() => void handlePay()}
        >
          {phase === "requesting" ? (
            <>
              <Loader2 className="animate-spin" />
              Starting payment&hellip;
            </>
          ) : phase === "connecting" ? (
            <>
              <Loader2 className="animate-spin" />
              Opening NIBtera&hellip;
            </>
          ) : phase === "awaiting" ? (
            <>
              <Loader2 className="animate-spin" />
              Awaiting confirmation&hellip;
            </>
          ) : phase === "failed" ? (
            "Try payment again"
          ) : (
            `Pay ${amount.toFixed(2)} ${currency}`
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Payment is processed securely by NIB Bank.
        </p>
      </div>
    </div>
  );
}
