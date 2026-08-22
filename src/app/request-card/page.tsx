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

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {!loadingUser && hasPendingRequest && (
              <Alert variant="warning" className="animate-fade-in">
                <Info />
                <AlertTitle>Card request pending</AlertTitle>
                <AlertDescription>
                  Your card request is waiting for approval. You cannot submit
                  another request until it has been reviewed.
                </AlertDescription>
              </Alert>
            )}
            {!loadingUser && !allowSelfRequest && !hasPendingRequest && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertTriangle />
                <AlertTitle>Self-service requests disabled</AlertTitle>
                <AlertDescription>
                  Your organization has not enabled self-initiated card requests.
                  Please contact support if you need a new card.
                </AlertDescription>
              </Alert>
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
              {loadingUser ? (
                <Skeleton className="h-11 w-full" />
              ) : cardPrograms.length === 0 ? (
                <p className="rounded-md border border-warning/25 bg-warning-muted px-3 py-2.5 text-sm text-warning-muted-foreground">
                  {allowSelfRequest
                    ? "No additional self-service card types are available — you may already hold all offered products, or none are configured."
                    : "No card programs are available for self-service requests."}
                </p>
              ) : (
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
              )}
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
                !selectedCardProgram
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
      </Card>
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
