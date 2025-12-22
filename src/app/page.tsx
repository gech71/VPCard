
'use client';

import React, { useState } from 'react';
import { cardDetails as cards, transactions, atmLimit, posLimit } from '@/lib/data';
import DashboardHeader from '@/components/dashboard-header';
import CardDisplay from '@/components/card-display';
import TransactionHistory from '@/components/transaction-history';
import LimitManager from '@/components/limit-manager';
import { Landmark, Store } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { CardDetails } from '@/lib/data';
import { cn } from '@/lib/utils';

export default function Home() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  React.useEffect(() => {
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

  return (
    <div className="min-h-screen w-full">
      <DashboardHeader />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 flex flex-col gap-4">
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
          <div className="lg:col-span-2">
            <TransactionHistory transactions={transactions} />
          </div>
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
            <LimitManager
              title="POS Limit"
              description="Set your daily Point of Sale transaction limit."
              icon={<Store className="h-6 w-6 text-primary" />}
              limitData={posLimit}
            />
            <LimitManager
              title="ATM Limit"
              description="Set your daily ATM withdrawal limit."
              icon={<Landmark className="h-6 w-6 text-primary" />}
              limitData={atmLimit}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
