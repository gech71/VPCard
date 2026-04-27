"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardHeader from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";

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

  useEffect(() => {
    if (!accountNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Account number is missing. Redirecting...",
      });
      router.push("/");
    }

    async function fetchUserData() {
      try {
        const res = await fetch("/api/get-cards");
        const data = await res.json();
        if (data.phoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      } catch (err) {
      } finally {
        setLoadingUser(false);
      }
    }
    fetchUserData();
  }, [accountNumber, router, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountNumber) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
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

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button 
        variant="ghost" 
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <Card className="border-2 shadow-lg overflow-hidden">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="space-y-1 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Request a New Card</CardTitle>
          </div>
          <CardDescription className="text-base">
            Submit a request for a new virtual card. Your request will be reviewed by a bank official.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="accountNumber" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked Account
                </Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  readOnly
                  className="bg-muted font-mono text-lg h-12 border-none focus-visible:ring-0 cursor-not-allowed"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="phoneNumber" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone Number
                </Label>
                <div className="relative">
                  <Input
                    id="phoneNumber"
                    value={loadingUser ? "Loading..." : phoneNumber}
                    readOnly
                    className="bg-muted font-mono text-lg h-12 border-none focus-visible:ring-0 cursor-not-allowed"
                  />
                  {loadingUser && <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address for notifications"
                className="h-12 text-lg border-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                required
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="notes" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Additional Notes
              </Label>
              <Textarea
                id="notes"
                className="min-h-[120px] resize-none text-base border-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefly describe the purpose of this card (e.g., Online Subscriptions, Business Expenses)"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-8">
            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Request...
                </>
              ) : (
                "Submit Card Request"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function RequestCardPage() {
  return (
    <div className="min-h-screen w-full bg-slate-50/50 dark:bg-slate-950">
      <DashboardHeader />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground font-medium">Loading request form...</p>
            </div>
        }>
          <RequestCardForm />
        </Suspense>
      </main>
    </div>
  );
}
