"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, CircleDot, KeyRound, CreditCard, Eye, EyeOff } from "lucide-react";
import type { CardDetails } from "@/lib/data";
import { VisaLogo, MastercardLogo, ChipIcon } from "@/components/icons";
import PinChangeDialog from "./pin-change-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type CardDisplayProps = {
  card: CardDetails;
};

export default function CardDisplay({ card }: CardDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  const getStatusVariant = (status: CardDetails['status']) => {
    switch (status) {
      case 'Active':
        return 'default';
      case 'Inactive':
        return 'secondary';
      case 'Frozen':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  return (
    <Card className="flex flex-col h-full shadow-md">
      <CardHeader>
        <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <CardTitle className="font-headline">Your Card</CardTitle>
        </div>
        <CardDescription>View your card details and balance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow justify-between gap-6">
        <div className="w-full aspect-[1.586] bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 rounded-xl p-4 sm:p-6 flex flex-col justify-between text-white shadow-xl">
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
                <span className="text-[10px] block opacity-70">Holder Name</span>
                <span>{card.cardholderName}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] block opacity-70">Expires</span>
                <span>{card.expiryDate}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-4xl font-bold tracking-tight">
              {currencyFormatter.format(card.balance)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Status:</p>
            <Badge variant={getStatusVariant(card.status)} className="flex items-center gap-1.5">
                <CircleDot className="h-3 w-3" />
                {card.status}
            </Badge>
          </div>
        </div>
        
        <PinChangeDialog>
            <Button variant="outline" className="w-full">
              <KeyRound className="mr-2 h-4 w-4" /> Change PIN
            </Button>
        </PinChangeDialog>
      </CardContent>
    </Card>
  );
}
