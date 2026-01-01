
'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { getCardLimits, type LimitApiResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
  
  const [isLimitsPending, startLimitsTransition] = useTransition();
  const [limitsFormState, limitsFormAction] = useFormState(getCardLimits, initialLimitsState);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (cardNumber) {
      const formData = new FormData();
      formData.append('card_numb', cardNumber);
      startLimitsTransition(() => {
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
    <div className="min-h-screen w-full bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              Limit Settings
            </h1>
          </div>
           <Button asChild variant="outline">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>
      </header>
      <main className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <Card>
            <CardHeader>
                <CardTitle>Manage Limits</CardTitle>
                <CardDescription>View and manage the transaction limits for your card ending in {cardNumber ? `...${cardNumber.slice(-4)}` : ''}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="atm" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="atm">ATM Channel</TabsTrigger>
                        <TabsTrigger value="pos">POS Channel</TabsTrigger>
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
        {!cardNumber && !isLimitsPending && (
             <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="text-destructive">Card Number Missing</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Could not find card number. Please return to the dashboard and try again.</p>
                </CardContent>
             </Card>
        )}
      </main>
    </div>
  );
}


export default function LimitsPage() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-screen" />}>
            <LimitsPageContent />
        </Suspense>
    )
}
