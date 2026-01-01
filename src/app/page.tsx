
'use client';

import { useState, useEffect } from 'react';
import { type CardDetails } from '@/lib/data';
import DashboardHeader from '@/components/dashboard-header';
import DashboardClient from '@/components/dashboard-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function Home() {
  const [cards, setCards] = useState<CardDetails[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCards() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/get-cards');
        if (!response.ok) {
          throw new Error('Failed to fetch card data.');
        }
        const data = await response.json();
        setCards(data.cards);
      } catch (e: any) {
        setError(e.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCards();
  }, []);

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
                        Please wait while we fetch your card details.
                    </AlertDescription>
                </Alert>
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
        {error && !isLoading && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    {error} Please try again later.
                </AlertDescription>
            </Alert>
        )}
        {cards && !isLoading && <DashboardClient cards={cards} />}
      </main>
    </div>
  );
}
