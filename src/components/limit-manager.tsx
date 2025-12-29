
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { LimitApiResponse } from "@/app/actions";

type LimitManagerProps = {
  allLimits: LimitApiResponse[];
  channel: 'ATM CHANNEL' | 'POS CHANNEL';
};

export default function LimitManager({ allLimits, channel }: LimitManagerProps) {
  const [selectedTxType, setSelectedTxType] = useState<string>('');
  const [currentLimit, setCurrentLimit] = useState(0);
  const [maxLimit, setMaxLimit] = useState(0);

  const { toast } = useToast();

  const availableTxTypes = Array.from(new Set(allLimits.map(l => l.transaction_type)));

  useEffect(() => {
    setSelectedTxType('');
    setCurrentLimit(0);
    setMaxLimit(0);
  }, [channel]);

  useEffect(() => {
    if (selectedTxType) {
        const relevantLimits = allLimits.filter(l => l.transaction_type === selectedTxType);
        const max = Math.max(...relevantLimits.map(l => l.mnt_limite));
        if (isFinite(max)) {
            setMaxLimit(max);
            setCurrentLimit(max); // Default to max
        } else {
            setMaxLimit(0);
            setCurrentLimit(0);
        }
    }
  }, [selectedTxType, allLimits]);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const handleSave = () => {
    // In a real app, this would be an API call
    console.log(`Saving new limit for ${channel} - ${selectedTxType}:`, currentLimit);
    toast({
      title: "Limit Updated",
      description: `Your new limit for ${selectedTxType} has been set to ${currencyFormatter.format(currentLimit)}.`,
    });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numericValue)) {
      if (numericValue > maxLimit) {
        setCurrentLimit(maxLimit)
      } else {
        setCurrentLimit(numericValue);
      }
    } else if (value === '') {
        setCurrentLimit(0)
    }
  };


  return (
    <div className="space-y-6 mt-6">
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Select transaction type to manage</p>
            <Select value={selectedTxType} onValueChange={setSelectedTxType}>
                <SelectTrigger>
                    <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent>
                    {availableTxTypes.map(txType => (
                        <SelectItem key={txType} value={txType}>{txType}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {selectedTxType && (
             <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg">Set New Limit</CardTitle>
                    <CardDescription>Adjust the limit for {selectedTxType}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <>
                        <div className="flex justify-between items-baseline gap-4">
                            <p className="text-sm text-muted-foreground">Your Limit</p>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                                <Input
                                    type="text"
                                    value={currentLimit.toLocaleString()}
                                    onChange={handleInputChange}
                                    className="w-36 text-right pr-4 pl-7 font-bold text-2xl h-auto border-0 focus-visible:ring-0 shadow-none bg-transparent"
                                />
                            </div>
                        </div>
                        <Slider
                        value={[currentLimit]}
                        onValueChange={(value) => setCurrentLimit(value[0])}
                        max={maxLimit}
                        step={50}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{currencyFormatter.format(0)}</span>
                            <span>{currencyFormatter.format(maxLimit)}</span>
                        </div>
                    </>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} className="w-full">
                    Save Changes
                    </Button>
                </CardFooter>
            </Card>
        )}
    </div>
  );
}
