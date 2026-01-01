
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleDot, KeyRound, CreditCard, Eye, EyeOff, ShieldCheck, Hash, Banknote, Network } from "lucide-react";
import type { CardDetails } from "@/lib/data";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";

type CardDetailsViewProps = {
  card: CardDetails;
  balance: number | null;
  isLoading: boolean;
};

export default function CardDetailsView({ card, balance, isLoading }: CardDetailsViewProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: card.currency || "USD",
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
            <CardTitle className="font-headline">Card Details</CardTitle>
        </div>
        <CardDescription>View your card details and balance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow justify-between gap-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Skeleton className="h-10 w-48" />
                    ) : (
                        <p className="text-4xl font-bold tracking-tight">
                        {isBalanceVisible ? currencyFormatter.format(balance ?? 0) : '•••••••'}
                        </p>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => setIsBalanceVisible(!isBalanceVisible)}>
                        {isBalanceVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Status:</p>
                <Badge variant={getStatusVariant(card.status)} className="flex items-center gap-1.5">
                    <CircleDot className="h-3 w-3" />
                    {card.status}
                </Badge>
            </div>
          </div>
        
          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Account No:</span>
                <span className="font-medium">{card.accountNumber}</span>
            </div>
            <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Card Type:</span>
                <span className="font-medium">{card.cardTypeNetwork}</span>
            </div>
            <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium">{card.type}</span>
            </div>
             <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Currency:</span>
                <span className="font-medium">{card.currency}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 pt-4">
            <Link href={`/limits?card_numb=${card.fullNumber}`} passHref>
                 <Button variant="outline" className="w-full">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Manage Limits
                </Button>
            </Link>
            <Link href={`/change-pin?card_numb=${card.fullNumber}`} passHref>
                <Button variant="outline" className="w-full">
                  <KeyRound className="mr-2 h-4 w-4" /> Change PIN
                </Button>
            </Link>
        </div>
      </CardContent>
    </Card>
  );
}
