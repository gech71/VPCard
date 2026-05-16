"use client";

import { useState, useEffect } from "react";
import { type CardDetails } from "@/lib/data";
import DashboardHeader from "@/components/dashboard-header";
import DashboardClient from "@/components/dashboard-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, Loader2, Plus } from "lucide-react";
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

        {!isLoading && !error && accounts.length > 0 && (
          <>
            {showNoCardsMessage && (
              <Alert
                className="mt-4"
                variant={selectedHasPendingRequest ? "default" : undefined}
              >
                {selectedHasPendingRequest ? (
                  <Info className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {selectedHasPendingRequest
                    ? "Card request pending"
                    : "There are no cards associated with this customer"}
                </AlertTitle>
                <AlertDescription className="flex flex-col gap-4">
                  {selectedHasPendingRequest ? (
                    <p className="text-sm text-muted-foreground">
                      Your card request is waiting for approval.
                    </p>
                  ) : showRequestCardButton ? (
                    <Button asChild>
                      <Link href={`/request-card?accountNumber=${selectedAccount}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Request a Card
                      </Link>
                    </Button>
                  ) : !allowSelfRequest ? (
                    <p className="text-sm text-muted-foreground">
                      Self-service card requests are not available. Please
                      contact support if you need assistance.
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
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
