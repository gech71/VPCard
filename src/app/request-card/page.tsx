"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardHeader from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CreditCard, AlertTriangle, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { filterProgramsNotOwnedByCustomerPans } from "@/lib/allowed-card-bins";
import {
  resolveBlocker,
  resolveStage,
  resolveSteps,
} from "@/lib/card-request-flow";
import TermsAgreement, {
  type PublishedTerms,
  type TermsStatus,
} from "@/components/terms-agreement";
import TermsContent from "@/components/terms-content";
import CardRequestPayment from "@/components/card-request-payment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BadgeCheck } from "lucide-react";

/**
 * The receipt for step 1, carried through the rest of the flow.
 *
 * Once the terms step is behind them a Guest still needs to see what they
 * agreed to - and be able to read it again - without the agreement itself
 * becoming re-editable after they have paid against it.
 */
function TermsAcceptedStrip({
  terms,
  onReview,
}: {
  terms: PublishedTerms;
  onReview: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-success/25 bg-success-muted px-3 py-2.5 text-sm text-success-muted-foreground">
      <BadgeCheck className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Terms &amp; Conditions
        {terms.version !== null ? ` (version ${terms.version})` : ""} accepted.
      </span>
      <button
        type="button"
        onClick={onReview}
        className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
      >
        Review
      </button>
    </div>
  );
}

function RequestCardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountNumber = searchParams.get("accountNumber");
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [cardPrograms, setCardPrograms] = useState<
    { code: string; name: string; bin: string }[]
  >([]);
  const [selectedCardProgram, setSelectedCardProgram] = useState("");
  const [allowSelfRequest, setAllowSelfRequest] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Terms & Conditions gate, the first step of the flow. When nothing is
  // published there is nothing to agree to, so the step is skipped rather than
  // holding every card request hostage to a missing document.
  const [terms, setTerms] = useState<PublishedTerms | null>(null);
  const [termsStatus, setTermsStatus] = useState<TermsStatus>("loading");
  const [termsAccepted, setTermsAccepted] = useState(false);
  /** Set when the Guest presses Continue, which is what advances the flow. */
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  /** Bumped to remount the terms panel after a failed load. */
  const [termsAttempt, setTermsAttempt] = useState(0);
  const [reviewingTerms, setReviewingTerms] = useState(false);

  // Card request fee. The Super Admin decides whether this Guest pays; the
  // amount is never chosen here, only displayed.
  const [feeLoading, setFeeLoading] = useState(true);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);
  const [feeCurrency, setFeeCurrency] = useState("ETB");
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!accountNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Account number is missing. Redirecting...",
      });
      router.push("/");
      return;
    }

    async function fetchUserData() {
      try {
        const cardRes = await fetch("/api/get-cards");
        const cardData = await cardRes.json();
        if (cardData.phoneNumber) {
          setPhoneNumber(cardData.phoneNumber);
        }
        setAllowSelfRequest(cardData.allowSelfRequest === true);

        const pendingAccounts: string[] =
          cardData.pendingCardRequestAccountNumbers || [];
        setHasPendingRequest(pendingAccounts.includes(accountNumber));

        const customerPans: string[] = cardData.customerCardPanNumbers || [];

        const progRes = await fetch("/api/card-programs?audience=self");
        const progData = await progRes.json();
        if (progRes.ok && Array.isArray(progData.programs)) {
          setCardPrograms(
            filterProgramsNotOwnedByCustomerPans(
              progData.programs,
              customerPans,
            ),
          );
        }
      } catch {
      } finally {
        setLoadingUser(false);
      }
    }
    void fetchUserData();

    // Read live, so a Super Admin toggling the fee applies to the very next
    // Guest request without a redeploy.
    async function loadFee() {
      try {
        const res = await fetch("/api/card-request-fee");
        const data = await res.json();
        if (!res.ok) return;

        setPaymentRequired(data.paymentRequired === true);
        setFeeAmount(Number(data.amount) || 0);
        setFeeCurrency(data.currency || "ETB");

        // A fee already paid for an attempt that was never finished.
        if (data.existingPayment?.transactionId) {
          setPaymentTransactionId(data.existingPayment.transactionId);
        }
      } catch {
        /* the gate below stays closed until the fee is known */
      } finally {
        setFeeLoading(false);
      }
    }
    void loadFee();
  }, [accountNumber, router, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountNumber) return;

    if (!allowSelfRequest) {
      toast({
        variant: "destructive",
        title: "Not available",
        description: "Self-initiated card requests are not enabled.",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      return;
    }

    if (!selectedCardProgram) {
      toast({
        variant: "destructive",
        title: "Card product required",
        description: "Please select a card program.",
      });
      return;
    }

    setIsSubmitting(true);

    // Normalize phone number (add +251 if missing)
    let normalizedPhone = phoneNumber.trim();
    if (normalizedPhone.startsWith("251")) {
      normalizedPhone = `+${normalizedPhone}`;
    } else if (normalizedPhone.startsWith("0")) {
      normalizedPhone = `+251${normalizedPhone.slice(1)}`;
    }

    try {
      const res = await fetch("/api/card-requests-self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            accountNumber,
            customerEmail: email,
            customerPhone: normalizedPhone,
            cardProgramCode: selectedCardProgram,
            notes,
            termsAccepted: terms ? termsAccepted : undefined,
            termsVersionId: terms?.id,
            paymentTransactionId: paymentTransactionId ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to submit request",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Your card request has been submitted successfully.",
      });

      router.push("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!accountNumber) return null;

  const fieldsDisabled = loadingUser || !allowSelfRequest || hasPendingRequest;

  // Flow: agree to the terms, then pay, then fill in the request. See
  // resolveStage for why blockers are checked before either gate.
  const blocker = resolveBlocker({
    loadingUser,
    hasPendingRequest,
    allowSelfRequest,
    cardProgramCount: cardPrograms.length,
  });

  const stage = resolveStage({
    feeLoading,
    loadingUser,
    blocker,
    termsStatus,
    termsConfirmed,
    paymentRequired,
    paymentTransactionId,
  });

  // Only the steps that actually apply to this Guest are shown, so a free
  // request with no published terms never advertises a step it will skip.
  const steps = resolveSteps({ termsStatus, paymentRequired });
  const currentStepIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in-up">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => router.push("/")}
      >
        <ArrowLeft />
        Back to dashboard
      </Button>

      <Card className="overflow-hidden shadow-md">
        <div aria-hidden="true" className="h-1.5 w-full bg-primary" />
        <CardHeader className="pb-6">
          <div className="mb-1 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
              <CreditCard className="h-5 w-5" />
            </span>
            <CardTitle className="font-headline text-xl sm:text-2xl">
              Request a New Card
            </CardTitle>
          </div>
          <CardDescription>
            Submit a request for a new prepaid card. Your request will be
            reviewed by a bank official.
          </CardDescription>
        </CardHeader>

        {steps.length > 1 && stage !== "loading" && stage !== "blocked" && (
          <div className="border-b border-border bg-muted/30 px-6 py-3">
            <ol className="flex items-center gap-2">
              {steps.map((step, index) => {
                const done = index < currentStepIndex;
                const active = index === currentStepIndex;
                return (
                  <li key={step.key} className="flex min-w-0 items-center gap-2">
                    <span
                      className={
                        done
                          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
                          : active
                            ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                            : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {done ? (
                        <BadgeCheck className="h-3.5 w-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={
                        active
                          ? "truncate text-sm font-semibold text-foreground"
                          : "truncate text-sm text-muted-foreground"
                      }
                    >
                      {step.label}
                    </span>
                    {index < steps.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="mx-1 h-px w-4 shrink-0 bg-border sm:w-8"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {stage === "loading" ? (
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </CardContent>
        ) : stage === "blocked" ? (
          /* Nothing to agree to and nothing to pay: this request cannot go
             ahead, so say so before either gate. */
          <CardContent className="space-y-4">
            {blocker === "pending" && (
              <Alert variant="warning" className="animate-fade-in">
                <Info />
                <AlertTitle>Card request pending</AlertTitle>
                <AlertDescription>
                  Your card request is waiting for approval. You cannot submit
                  another request until it has been reviewed.
                </AlertDescription>
              </Alert>
            )}
            {blocker === "disabled" && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertTriangle />
                <AlertTitle>Self-service requests disabled</AlertTitle>
                <AlertDescription>
                  Your organization has not enabled self-initiated card requests.
                  Please contact support if you need a new card.
                </AlertDescription>
              </Alert>
            )}
            {blocker === "noPrograms" && (
              <Alert variant="warning" className="animate-fade-in">
                <Info />
                <AlertTitle>No card products available</AlertTitle>
                <AlertDescription>
                  No additional self-service card types are available — you may
                  already hold all offered products, or none are configured.
                </AlertDescription>
              </Alert>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Back to dashboard
            </Button>
          </CardContent>
        ) : stage === "terms" ? (
          /* Step 1: agree to the terms in force before anything is charged. */
          <CardContent className="space-y-5">
            <TermsAgreement
              key={termsAttempt}
              accepted={termsAccepted}
              onAcceptedChange={setTermsAccepted}
              onTermsLoaded={setTerms}
              onStatusChange={setTermsStatus}
            />

            {termsStatus === "failed" ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setTermsStatus("loading");
                  setTermsAttempt((n) => n + 1);
                }}
              >
                Try again
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                disabled={termsStatus !== "ready" || !termsAccepted}
                onClick={() => setTermsConfirmed(true)}
              >
                {paymentRequired && !paymentTransactionId
                  ? `Agree and continue to payment`
                  : "Agree and continue"}
              </Button>
            )}
          </CardContent>
        ) : stage === "payment" ? (
          /* Step 2: the fee must clear before the form is reachable. */
          <CardContent className="space-y-4">
            {terms && (
              <TermsAcceptedStrip
                terms={terms}
                onReview={() => setReviewingTerms(true)}
              />
            )}
            <CardRequestPayment
              amount={feeAmount}
              currency={feeCurrency}
              onPaid={setPaymentTransactionId}
            />
          </CardContent>
        ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {paymentRequired ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-success/25 bg-success-muted px-3 py-2.5 text-sm text-success-muted-foreground">
                <BadgeCheck className="h-4 w-4 shrink-0" />
                <span>
                  Card request fee of{" "}
                  <span className="font-semibold">
                    {feeAmount.toFixed(2)} {feeCurrency}
                  </span>{" "}
                  paid. Complete your request below.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border border-info/25 bg-info-muted px-3 py-2.5 text-sm text-info-muted-foreground">
                <BadgeCheck className="h-4 w-4 shrink-0" />
                <span>This card request is currently free of charge.</span>
              </div>
            )}
            {terms && (
              <TermsAcceptedStrip
                terms={terms}
                onReview={() => setReviewingTerms(true)}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <div className="relative">
                <Input
                  id="phoneNumber"
                  value={loadingUser ? "" : phoneNumber}
                  readOnly
                  disabled={fieldsDisabled}
                  className="h-11 font-mono"
                />
                {loadingUser && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Taken from your registered account. It cannot be edited here.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardProgram">
                Card product <span className="text-destructive">*</span>
              </Label>
              {/* An empty list or a still-loading profile never reaches this
                  step - both are handled before the terms gate. */}
              <Select
                value={selectedCardProgram}
                onValueChange={setSelectedCardProgram}
                disabled={fieldsDisabled}
              >
                <SelectTrigger id="cardProgram" className="h-11">
                  <SelectValue placeholder="Select card type" />
                </SelectTrigger>
                <SelectContent>
                  {cardPrograms.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name} ({p.code}) — BIN {p.bin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11"
                required
                disabled={fieldsDisabled}
              />
              <p className="text-xs text-muted-foreground">
                We will send card notifications to this address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional notes</Label>
              <Textarea
                id="notes"
                className="min-h-[110px] resize-y"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefly describe the purpose of this card (e.g., online subscriptions, business expenses)"
                disabled={fieldsDisabled}
              />
            </div>

          </CardContent>

          <CardFooter className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={
                isSubmitting ||
                !allowSelfRequest ||
                hasPendingRequest ||
                cardPrograms.length === 0 ||
                !selectedCardProgram ||
                // Belt and braces: the terms gate is a step of its own now, so
                // this can only fail if that step was somehow bypassed.
                (terms !== null && !termsAccepted)
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Processing request&hellip;
                </>
              ) : (
                "Submit card request"
              )}
            </Button>
          </CardFooter>
        </form>
        )}
      </Card>

      <Dialog open={reviewingTerms} onOpenChange={setReviewingTerms}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{terms?.title ?? "Terms & Conditions"}</DialogTitle>
            <DialogDescription>
              {terms?.version !== null && terms?.version !== undefined
                ? `Version ${terms.version} — the version you accepted for this request.`
                : "The version you accepted for this request."}
            </DialogDescription>
          </DialogHeader>
          {terms && <TermsContent content={terms.content} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestCardFallback() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-[36rem] w-full rounded-xl" />
    </div>
  );
}

export default function RequestCardPage() {
  return (
    <div className="min-h-dvh w-full bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<RequestCardFallback />}>
          <RequestCardForm />
        </Suspense>
      </main>
    </div>
  );
}
