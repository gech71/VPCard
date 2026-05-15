"use client";

import { useState, useEffect } from "react";
import { type CardDetails } from "@/lib/data";
import DashboardHeader from "@/components/dashboard-header";
import DashboardClient from "@/components/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface CardResponse {
  cards: CardDetails[];
  accounts?: any[];
  allowSelfRequest?: boolean;
  defaultCheckerId?: string | null;
  customerCardPanNumbers?: string[];
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
        const list = data.accounts || [];
        setAccounts(list);

        if (list.length > 0) {
          setSelectedAccount(list[0].accountNumber);
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
    const accountNumber = selectedAccount;

    async function fetchCards() {
      try {
        setIsLoadingCards(true);
        const response = await fetch(
          `/api/get-cards?accountNumber=${encodeURIComponent(accountNumber)}`,
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
    !isLoading &&
    !isLoadingCards &&
    selectedAccount &&
    (!cards || cards.length === 0);

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

        {!isLoading && !error && accounts.length === 0 && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No accounts found</AlertTitle>
            <AlertDescription>
              We could not find any accounts linked to your phone number.
            </AlertDescription>
          </Alert>
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
                <AlertTitle>
                  There are no cards associated with this customer
                </AlertTitle>
                <AlertDescription className="flex flex-col gap-4">
                  {allowSelfRequest ? (
                    <Button asChild>
                      <Link href={`/request-card?accountNumber=${selectedAccount}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Request a Card
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Self-service card requests are not available. Please
                      contact support if you need assistance.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {cards && cards.length > 0 && (
              <DashboardClient
                cards={cards}
                allowSelfRequest={allowSelfRequest}
                accountNumber={selectedAccount}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
