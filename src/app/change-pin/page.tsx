
'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PinChangeForm from '@/components/pin-change-form';
import { Skeleton } from '@/components/ui/skeleton';

function ChangePinPageContent() {
  const searchParams = useSearchParams();
  const cardNumber = searchParams.get('card_numb');

  return (
    <div className="min-h-screen w-full bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-start">
          <div className="flex items-center gap-3">
            <KeyRound className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              Change PIN
            </h1>
          </div>
        </div>
      </header>
      <main className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
        <div className="flex justify-end mb-4">
          <Button asChild variant="outline">
            <Link href="/" prefetch={false}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Change Your PIN</CardTitle>
            <CardDescription>
                Enter your current PIN and a new 4-digit PIN for your card ending in {cardNumber ? `...${cardNumber.slice(-4)}` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cardNumber ? (
              <PinChangeForm cardNumber={cardNumber} />
            ) : (
              <div className="text-destructive">
                <p>Card number not found. Please go back to the dashboard and try again.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function ChangePinPage() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-screen" />}>
            <ChangePinPageContent />
        </Suspense>
    );
}
