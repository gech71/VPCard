"use client";

import { useState, useEffect } from "react";
import { type CardDetails } from "@/lib/data";
import DashboardHeader from "@/components/dashboard-header";
import DashboardClient from "@/components/dashboard-client";
import EmptyState from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CreditCard,
  Clock,
  Plus,
  SearchX,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { filterProgramsNotOwnedByCustomerPans } from "@/lib/allowed-card-bins";

interface CardResponse {
  cards: CardDetails[];
  accounts?: any[];
  allowSelfRequest?: boolean;
  defaultCheckerId?: string | null;
  customerCardPanNumbers?: string[];
  pendingCardRequestAccountNumbers?: string[];
  error?: string | null;
}

/** Placeholder that mirrors the real dashboard layout while data loads. */
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Skeleton className="ml-auto h-4 w-12" />
          <Skeleton className="mx-auto aspect-[1.586] w-full max-w-md rounded-xl" />
          <div className="flex justify-center gap-2">
            <Skeleton className="h-2 w-4 rounded-full" />
            <Skeleton className="h-2 w-2 rounded-full" />
          </div>
        </div>
        <Card>
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-48" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="space-y-3 p-5 sm:p-6">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const [cards, setCards] = useState<CardDetails[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowSelfRequest, setAllowSelfRequest] = useState(false);
  const [canRequestNewCard, setCanRequestNewCard] = useState(false);
  const [pendingRequestAccounts, setPendingRequestAccounts] = useState<string[]>(
    [],
  );
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
        if (data.error) {
          throw new Error(data.error);
        }
        const selfServiceEnabled = data.allowSelfRequest === true;
        setAllowSelfRequest(selfServiceEnabled);
        setCards(data.cards || []);
        const list = data.accounts || [];
        setAccounts(list);

        let hasEligibleProducts = false;
        if (selfServiceEnabled) {
          const customerPans: string[] = data.customerCardPanNumbers || [];
          const progRes = await fetch("/api/card-programs?audience=self");
          const progData = await progRes.json();
          if (progRes.ok && Array.isArray(progData.programs)) {
            hasEligibleProducts =
              filterProgramsNotOwnedByCustomerPans(
                progData.programs,
                customerPans,
              ).length > 0;
          }
        }
        setCanRequestNewCard(hasEligibleProducts);
        setPendingRequestAccounts(
          data.pendingCardRequestAccountNumbers || [],
        );

        if (list.length > 0) {
          setSelectedAccount(list[0].accountNumber);
        } else if (data.cards?.length > 0 && data.cards[0].accountNumber) {
          setSelectedAccount(data.cards[0].accountNumber);
        }
      } catch (e: any) {
        setError(e.message || "An unknown error occurred.");
        toast({
          variant: "destructive",
          title: "Error",
          description: e.message || "Failed to load your cards.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialData();
  }, [toast]);

  const showNoCardsMessage =
    !isLoading && accounts.length > 0 && (!cards || cards.length === 0);

  const selectedHasPendingRequest =
    Boolean(selectedAccount) &&
    pendingRequestAccounts.includes(selectedAccount!);

  const showRequestCardButton =
    canRequestNewCard && !selectedHasPendingRequest;

  return (
    <div className="min-h-dvh w-full bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {isLoading && <DashboardSkeleton />}

        {!isLoading && !error && accounts.length === 0 && (
          <Card className="animate-fade-in-up">
            <CardContent className="p-5 sm:p-6">
              <EmptyState
                icon={SearchX}
                title="No accounts found"
                description="We could not find any accounts linked to your phone number."
              />
            </CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Alert variant="destructive" className="animate-fade-in-up">
            <AlertTriangle />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error} Please try again later.</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && accounts.length > 0 && (
          <>
            {showNoCardsMessage && (
              <Card className="animate-fade-in-up">
                <CardContent className="p-5 sm:p-6">
                  <EmptyState
                    icon={selectedHasPendingRequest ? Clock : CreditCard}
                    title={
                      selectedHasPendingRequest
                        ? "Card request pending"
                        : "No cards on this account"
                    }
                    description={
                      selectedHasPendingRequest
                        ? "Your card request is waiting for approval."
                        : showRequestCardButton
                          ? "You do not have a card yet. Request one to get started."
                          : !allowSelfRequest
                            ? "Self-service card requests are not available. Please contact support if you need assistance."
                            : undefined
                    }
                    action={
                      !selectedHasPendingRequest && showRequestCardButton ? (
                        <Button asChild>
                          <Link
                            href={`/request-card?accountNumber=${selectedAccount}`}
                          >
                            <Plus />
                            Request a card
                          </Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </CardContent>
              </Card>
            )}

            {cards && cards.length > 0 && selectedAccount && (
              <DashboardClient
                cards={cards}
                allowSelfRequest={allowSelfRequest}
                canRequestNewCard={canRequestNewCard}
                pendingRequestAccounts={pendingRequestAccounts}
                accountNumber={selectedAccount}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
