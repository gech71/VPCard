"use client";

import { useState, useEffect } from "react";
import { type CardDetails } from "@/lib/data";
import DashboardHeader from "@/components/dashboard-header";
import DashboardClient from "@/components/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Plus, UserCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface CardResponse {
  cards: CardDetails[];
  accounts?: any[];
  allowSelfRequest?: boolean;
  defaultCheckerId?: string | null;
}

export default function Home() {
  const [cards, setCards] = useState<CardDetails[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowSelfRequest, setAllowSelfRequest] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchInitialData() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/get-cards");
        if (!response.ok) {
          throw new Error("Failed to fetch initial data.");
        }
        const data: CardResponse = await response.json();
        setAllowSelfRequest(data.allowSelfRequest || false);
        setAccounts(data.accounts || []);

        // Auto-select if only one account exists
        if (data.accounts && data.accounts.length === 1) {
          setSelectedAccount(data.accounts[0].accountNumber);
        }
      } catch (e: any) {
        setError(e.message || "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;

    async function fetchCards() {
      try {
        setIsLoadingCards(true);
        const response = await fetch(
          `/api/get-cards?accountNumber=${selectedAccount}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch card data.");
        }
        const data: CardResponse = await response.json();
        setCards(data.cards);
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: e.message || "Failed to load cards for this account.",
        });
      } finally {
        setIsLoadingCards(false);
      }
    }
    fetchCards();
  }, [selectedAccount, toast]);

  const showNoCardsMessage =
    !isLoading && !isLoadingCards && selectedAccount && (!cards || cards.length === 0);

  return (
    <div className="min-h-screen w-full bg-background">
      <DashboardHeader />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {isLoading && (
          <div className="space-y-8">
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Loading...</AlertTitle>
              <AlertDescription>
                Please wait while we fetch your account details.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {!selectedAccount && !isLoading && accounts.length > 1 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="p-4 bg-primary/10 rounded-full">
              <UserCheck className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Welcome</h2>
              <p className="text-muted-foreground max-w-md">
                We found multiple accounts associated with your phone number.
                Please select an account to view your virtual cards.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
              {accounts.map((acc) => (
                <Card 
                  key={acc.accountNumber}
                  className="cursor-pointer border-2 hover:border-primary hover:shadow-lg transition-all group relative overflow-hidden"
                  onClick={() => setSelectedAccount(acc.accountNumber)}
                >
                  <div className="absolute right-0 top-0 h-full w-1 bg-primary transform translate-x-full group-hover:translate-x-0 transition-transform" />
                  <CardHeader className="p-5 flex flex-row items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">Account Number</p>
                      <p className="font-mono text-xl font-bold tracking-tight">{acc.accountNumber}</p>
                      <p className="text-sm text-muted-foreground font-medium">{acc.name}</p>
                    </div>
                    <ArrowRight className="ml-auto w-5 h-5 text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error} Please try again later.</AlertDescription>
          </Alert>
        )}

        {selectedAccount && isLoadingCards && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div className="flex flex-col gap-4">
                    <Skeleton className="aspect-[1.586] w-full max-w-md mx-auto rounded-xl" />
                    <div className="flex justify-center gap-2">
                      <Skeleton className="h-2 w-4 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full bg-muted" />
                      <Skeleton className="h-2 w-2 rounded-full bg-muted" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 h-full">
                    <Skeleton className="h-[400px] w-full" />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-3 mt-8">
                <Skeleton className="h-[420px] w-full" />
              </div>
            </div>
          </div>
        )}

        {selectedAccount && !isLoadingCards && (
          <>
            {showNoCardsMessage && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Cards Available</AlertTitle>
                <AlertDescription className="flex flex-col gap-4">
                  <p>
                    You don't have any cards associated with account{" "}
                    <span className="font-mono font-bold bg-muted px-1 rounded">
                      {selectedAccount}
                    </span>.
                  </p>
                  {allowSelfRequest ? (
                    <Button asChild>
                      <Link href={`/request-card?accountNumber=${selectedAccount}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Request a Card
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Please contact support for account {selectedAccount} if you believe this is an error.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {cards && cards.length > 0 && <DashboardClient cards={cards} />}

            {/* {allowSelfRequest && cards && cards.length > 0 && (
              <div className="mt-8 flex justify-center">
                <Button variant="outline" size="lg" asChild>
                  <Link href={`/request-card?accountNumber=${selectedAccount}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Request Another Card
                  </Link>
                </Button>
              </div>
            )} */}
          </>
        )}
      </main>
    </div>
  );
}
