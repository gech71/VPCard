
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
import { CircleDot, KeyRound, CreditCard, Eye, EyeOff, ShieldCheck } from "lucide-react";
import type { CardDetails } from "@/lib/data";
import PinChangeDialog from "./pin-change-dialog";
import ViewLimitsDialog from "./view-limits-dialog";

type CardDetailsViewProps = {
  card: CardDetails;
};

export default function CardDetailsView({ card }: CardDetailsViewProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);

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
            <CardTitle className="font-headline">Card Details</CardTitle>
        </div>
        <CardDescription>View your card details and balance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow justify-between gap-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <div className="flex items-center gap-2">
                <p className="text-4xl font-bold tracking-tight">
                {isBalanceVisible ? currencyFormatter.format(card.balance) : '$•••••••'}
                </p>
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
        
        <div className="grid grid-cols-2 gap-2">
            <ViewLimitsDialog>
                <Button variant="outline" className="w-full">
                    <ShieldCheck className="mr-2 h-4 w-4" /> View Limits
                </Button>
            </ViewLimitsDialog>
            <PinChangeDialog>
                <Button variant="outline" className="w-full">
                  <KeyRound className="mr-2 h-4 w-4" /> Change PIN
                </Button>
            </PinChangeDialog>
        </div>
      </CardContent>
    </Card>
  );
}
