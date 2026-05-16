"use client";

import React, { useState, useEffect, useActionState, startTransition } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import CardDisplay from "@/components/card-display";
import CardDetailsView from "@/components/card-details-view";
import type { CardDetails, Transaction } from "@/lib/data";
import TransactionHistory from "@/components/transaction-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { getCardTransactions } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

type DashboardClientProps = {
  cards: CardDetails[];
  allowSelfRequest: boolean;
  canRequestNewCard: boolean;
  pendingRequestAccounts: string[];
  accountNumber: string;
};

const initialTransactionState = {
  transactions: [] as Transaction[],
  balance: 0 as number,
  error: null as string | null,
};

export default function DashboardClient({
  cards,
  allowSelfRequest,
  canRequestNewCard,
  pendingRequestAccounts,
  accountNumber,
}: DashboardClientProps) {
  const hasPendingCardRequest = pendingRequestAccounts.includes(accountNumber);
  const showRequestNewCard = canRequestNewCard && !hasPendingCardRequest;
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const { toast } = useToast();
  const [txFormState, txFormAction, isTxPending] = useActionState(getCardTransactions, initialTransactionState);

  const selectedCard = cards[current];

  useEffect(() => {
    if (selectedCard) {
      const formData = new FormData();
      formData.append("card_numb", selectedCard.fullNumber);
      startTransition(() => {
        txFormAction(formData);
      });
    }
  }, [current, cards, selectedCard]);

  useEffect(() => {
    if (txFormState.error) {
      toast({
        variant: "destructive",
        title: "Error fetching transactions",
        description: txFormState.error,
      });
    }
  }, [txFormState.error, toast]);

  useEffect(() => {
    if (!api) {
      return;
    }
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", handleSelect);
    api.on("reInit", () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    });

    return () => {
      api.off("select", handleSelect);
      api.off("reInit", () => {
        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap());
      });
    };
  }, [api]);

  const handleDotClick = (index: number) => {
    api?.scrollTo(index);
  };

  if (!cards || cards.length === 0) {
    return null;
  }

  const isLoading = isTxPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              {count > 0 && (
                <div className="text-sm text-muted-foreground">
                  {current + 1} / {count}
                </div>
              )}
            </div>
            <Carousel setApi={setApi} className="w-full">
              <CarouselContent>
                {cards.map((card, index) => (
                  <CarouselItem key={index}>
                    <CardDisplay card={card} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            <div className="flex justify-center gap-2">
              {cards.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    current === index ? "w-4 bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4 h-full">
            {selectedCard && (
              <CardDetailsView
                card={selectedCard}
                balance={txFormState.balance}
                isLoading={isLoading}
                allowSelfRequest={allowSelfRequest}
                canRequestNewCard={showRequestNewCard}
                hasPendingCardRequest={hasPendingCardRequest}
                accountNumber={accountNumber}
              />
            )}
          </div>
        </div>
      </div>
      <div className="lg:col-span-3 mt-8">
        <TransactionHistory
          transactions={txFormState.transactions}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
