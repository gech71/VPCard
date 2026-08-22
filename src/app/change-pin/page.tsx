'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import AppHeader from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PinChangeForm from '@/components/pin-change-form';
import { Skeleton } from '@/components/ui/skeleton';

function ChangePinPageContent() {
  const searchParams = useSearchParams();
  const cardNumber = searchParams.get('card_numb');

  return (
    <div className="min-h-dvh w-full bg-background">
      <AppHeader title="NIB Prepaid Card" subtitle="Change PIN" homeHref="/" />

      <main className="mx-auto max-w-xl p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/" prefetch={false}>
              <ArrowLeft />
              Back to dashboard
            </Link>
          </Button>
        </div>

        {!cardNumber ? (
          <Alert variant="destructive" className="animate-fade-in-up">
            <AlertTriangle />
            <AlertTitle>Card number missing</AlertTitle>
            <AlertDescription>
              Card number not found. Please go back to the dashboard and try
              again.
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle className="font-headline">Change your PIN</CardTitle>
              <CardDescription>
                Enter your current PIN and a new 4-digit PIN for your card ending
                in{' '}
                <span className="font-mono font-medium text-foreground">
                  {`••••${cardNumber.slice(-4)}`}
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PinChangeForm cardNumber={cardNumber} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function ChangePinFallback() {
  return (
    <div className="min-h-dvh w-full bg-background">
      <AppHeader title="NIB Prepaid Card" subtitle="Change PIN" homeHref="/" />
      <main className="mx-auto max-w-xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </main>
    </div>
  );
}

export default function ChangePinPage() {
    return (
        <Suspense fallback={<ChangePinFallback />}>
            <ChangePinPageContent />
        </Suspense>
    );
}
