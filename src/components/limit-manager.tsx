
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import type { Limit } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Skeleton } from "./ui/skeleton";

type LimitManagerProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  limitData: Limit;
  isLoading: boolean;
};

export default function LimitManager({ title, description, icon, limitData, isLoading }: LimitManagerProps) {
  const [currentLimit, setCurrentLimit] = useState(limitData.current);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentLimit(limitData.current);
  }, [limitData]);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const handleSave = () => {
    // In a real app, this would be an API call
    console.log(`Saving new ${title}:`, currentLimit);
    toast({
      title: "Limit Updated",
      description: `Your new ${title} has been set to ${currencyFormatter.format(currentLimit)}.`,
    });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numericValue)) {
      if (numericValue > limitData.max) {
        setCurrentLimit(limitData.max)
      } else {
        setCurrentLimit(numericValue);
      }
    } else if (value === '') {
        setCurrentLimit(0)
    }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          {icon}
          <CardTitle className="font-headline">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
            <div className="space-y-4">
                <div className="flex justify-between items-baseline gap-4">
                    <p className="text-sm text-muted-foreground">Your Limit</p>
                    <Skeleton className="h-8 w-36" />
                </div>
                <Skeleton className="h-2 w-full" />
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                </div>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-baseline gap-4">
                    <p className="text-sm text-muted-foreground">Your Limit</p>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                        <Input
                            type="text"
                            value={currentLimit.toLocaleString()}
                            onChange={handleInputChange}
                            className="w-36 text-right pr-4 pl-7 font-bold text-2xl h-auto border-0 focus-visible:ring-0 shadow-none"
                        />
                    </div>
                </div>
                <Slider
                value={[currentLimit]}
                onValueChange={(value) => setCurrentLimit(value[0])}
                max={limitData.max}
                step={50}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{currencyFormatter.format(0)}</span>
                    <span>{currencyFormatter.format(limitData.max)}</span>
                </div>
            </>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
