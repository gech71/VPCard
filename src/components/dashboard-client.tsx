
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useFormState } from 'react-dom';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import CardDisplay from '@/components/card-display';
import CardDetailsView from '@/components/card-details-view';
import type { CardDetails, Transaction, Limit } from '@/lib/data';
import TransactionHistory from '@/components/transaction-history';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Landmark, Store } from 'lucide-react';
import { getCardTransactions, getCardLimits, type LimitApiResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import LimitSettingsDialog from './limit-settings-dialog';

type DashboardClientProps = {
    cards: CardDetails[];
};

const initialTransactionState = {
  transactions: [] as Transaction[],
  balance: null as number | null,
  error: null as string | null,
};

const initialLimitsState = {
    posLimit: { current: 0, max: 0 } as Limit,
    atmLimit: { current: 0, max: 0 } as Limit,
    allLimits: [] as LimitApiResponse[],
    error: null as string | null,
};

export default function DashboardClient({ cards }: DashboardClientProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  
  const { toast } = useToast();
  const [isTxPending, startTxTransition] = useTransition();
  const [isLimitsPending, startLimitsTransition] = useTransition();
  const [txFormState, txFormAction] = useFormState(getCardTransactions, initialTransactionState);
  const [limitsFormState, limitsFormAction] = useFormState(getCardLimits, initialLimitsState);
  
  const selectedCard = cards[current];

  useEffect(() => {
    if (selectedCard) {
      const formData = new FormData();
      formData.append('card_numb', selectedCard.fullNumber);
      startTxTransition(() => {
        txFormAction(formData);
      });
      startLimitsTransition(() => {
        limitsFormAction(formData);
      })
    }
  }, [current, cards, txFormAction, limitsFormAction]);

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
    if (limitsFormState.error) {
        toast({
            variant: "destructive",
            title: "Error fetching limits",
            description: limitsFormState.error,
        });
    }
  }, [limitsFormState.error, toast]);


  useEffect(() => {
    if (!api) {
      return;
    }
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on('select', handleSelect);
     api.on("reInit", () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    });

    return () => {
      api.off('select', handleSelect);
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
    return (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
                Could not retrieve card details. Please ensure you are connected and try again later.
            </AlertDescription>
        </Alert>
    )
  }
  
  const isLoading = isTxPending || isLimitsPending;

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
                            'h-2 w-2 rounded-full transition-all',
                            current === index ? 'w-4 bg-primary' : 'bg-muted'
                        )}
                        />
                    ))}
                    </div>
                </div>
                <div className="flex flex-col gap-4 h-full">
                    {selectedCard && <CardDetailsView card={selectedCard} balance={txFormState.balance} isLoading={isLoading} allLimits={limitsFormState.allLimits} posLimit={limitsFormState.posLimit} atmLimit={limitsFormState.atmLimit} />}
                </div>
            </div>
        </div>
        <div className="lg:col-span-3 mt-8">
            <TransactionHistory transactions={txFormState.transactions} isLoading={isLoading} />
        </div>
    </div>
  );
}
