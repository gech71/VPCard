
'use client';

import React, { useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import CardDisplay from '@/components/card-display';
import CardDetailsView from '@/components/card-details-view';
import type { CardDetails } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

type DashboardClientProps = {
    cards: CardDetails[];
};

export default function DashboardClient({ cards }: DashboardClientProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const selectedCard = cards[current];

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

  return (
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
          {selectedCard && <CardDetailsView card={selectedCard} />}
      </div>
    </div>
  );
}
