
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import type { CardDetails } from "@/lib/data";
import { ChipIcon } from "@/components/icons";

type CardDisplayProps = {
  card: CardDetails;
};

export default function CardDisplay({ card }: CardDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <Card className="flex flex-col h-full shadow-md w-full max-w-md mx-auto">
      <CardContent className="flex flex-col flex-grow justify-between gap-6 p-0">
        <div className="w-full aspect-[1.586] bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 rounded-xl p-4 sm:p-6 flex flex-col justify-between text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
                <ChipIcon className="w-10 h-10 sm:w-12 sm:h-12" />
                <div className="flex flex-col">
                  <p className="font-bold text-lg">NIB INTERNATIONAL BANK</p>
                  <p className="text-xs">የላቀ የደንበኝነት አገልግሎት : ለጋራ ስኬት!</p>
                </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between w-full">
                <p className="text-xl sm:text-2xl font-mono tracking-wider">
                    {isRevealed ? card.fullNumber : card.maskedNumber}
                </p>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setIsRevealed(!isRevealed)}>
                    {isRevealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
            </div>
            <div className="flex justify-between items-end text-sm uppercase font-semibold">
              <div>
                <span className="text-[8px] block opacity-70">Holder Name</span>
                <span>{card.cardholderName}</span>
              </div>
              <div className="text-right flex items-center gap-2">
                  <span className="text-[8px] opacity-70">Expires</span>
                  <div className="text-right">
                    <span className="text-[8px] block opacity-70">Month/Year</span>
                    <span>{card.expiryDate}</span>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
