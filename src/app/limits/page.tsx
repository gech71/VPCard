'use client';

import React, { useState, useEffect, Suspense, useActionState, startTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Landmark, Store } from 'lucide-react';
import { getCardLimits, type LimitApiResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import AppHeader from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LimitSummary from '@/components/limit-summary';
import { Skeleton } from '@/components/ui/skeleton';

const initialLimitsState = {
    posLimit: { current: 0, max: 0 },
    atmLimit: { current: 0, max: 0 },
    allLimits: [] as LimitApiResponse[],
    error: null as string | null,
};

function LimitsPageContent() {
  const searchParams = useSearchParams();
  const cardNumber = searchParams.get('card_numb');
  const { toast } = useToast();

  const [limitsFormState, limitsFormAction, isLimitsPending] = useActionState(getCardLimits, initialLimitsState);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (cardNumber) {
      const formData = new FormData();
      formData.append('card_numb', cardNumber);
      startTransition(() => {
        limitsFormAction(formData);
      });
    }
  }, [cardNumber, limitsFormAction, refreshKey]);

  useEffect(() => {
    if (limitsFormState.error) {
        toast({
            variant: "destructive",
            title: "Error fetching limits",
            description: limitsFormState.error,
        });
    }
  }, [limitsFormState.error, toast]);

  const handleLimitUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  const atmLimits = limitsFormState.allLimits.filter(limit => limit.channel === 'ATM CHANNEL');
  const posLimits = limitsFormState.allLimits.filter(limit => limit.channel === 'POS CHANNEL');

  return (
    <div className="min-h-dvh w-full bg-background">
      <AppHeader title="NIB Prepaid Card" subtitle="Limit settings" homeHref="/" />

      <main className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/" prefetch={false}>
              <ArrowLeft />
              Back to dashboard
            </Link>
          </Button>
        </div>

        {!cardNumber && !isLimitsPending ? (
          <Alert variant="destructive" className="animate-fade-in-up">
            <AlertTriangle />
            <AlertTitle>Card number missing</AlertTitle>
            <AlertDescription>
              Could not find the card number. Please return to the dashboard and
              try again.
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="animate-fade-in-up overflow-hidden">
            <CardHeader>
              <CardTitle className="font-headline">Manage Limits</CardTitle>
              <CardDescription>
                View and manage the transaction limits for your card ending in{' '}
                <span className="font-mono font-medium text-foreground">
                  {cardNumber ? `••••${cardNumber.slice(-4)}` : ''}
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="atm" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="atm">
                    <Landmark className="h-4 w-4" />
                    ATM Channel
                  </TabsTrigger>
                  <TabsTrigger value="pos">
                    <Store className="h-4 w-4" />
                    POS Channel
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="atm">
                  <LimitSummary allLimits={atmLimits} isLoading={isLimitsPending} onUpdate={handleLimitUpdate} />
                </TabsContent>
                <TabsContent value="pos">
                  <LimitSummary allLimits={posLimits} isLoading={isLimitsPending} onUpdate={handleLimitUpdate} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function LimitsPageFallback() {
  return (
    <div className="min-h-dvh w-full bg-background">
      <AppHeader title="NIB Prepaid Card" subtitle="Limit settings" homeHref="/" />
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-[26rem] w-full rounded-xl" />
      </main>
    </div>
  );
}

export default function LimitsPage() {
    return (
        <Suspense fallback={<LimitsPageFallback />}>
            <LimitsPageContent />
        </Suspense>
    )
}
