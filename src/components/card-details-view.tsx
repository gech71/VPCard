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
import { Button } from "@/components/ui/button";
import {
  Banknote,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Network,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { CardDetails } from "@/lib/data";
import StatusBadge from "./status-badge";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";

type CardDetailsViewProps = {
  card: CardDetails;
  balance: number | null;
  isLoading: boolean;
  allowSelfRequest?: boolean;
  canRequestNewCard?: boolean;
  hasPendingCardRequest?: boolean;
  accountNumber?: string;
};

/** One label/value row in the card metadata grid. */
function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function CardDetailsView({
  card,
  balance,
  isLoading,
  allowSelfRequest = false,
  canRequestNewCard = false,
  hasPendingCardRequest = false,
  accountNumber,
}: CardDetailsViewProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: card.currency || "USD",
  });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="space-y-0.5">
            <CardTitle className="font-headline">Card Details</CardTitle>
            <CardDescription>View your card details and balance.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-grow flex-col justify-between gap-6">
        <div className="space-y-5">
          {/* Balance */}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Current Balance
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                aria-pressed={isBalanceVisible}
                aria-label={
                  isBalanceVisible ? "Hide balance" : "Show balance"
                }
              >
                {isBalanceVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <div className="mt-1 min-h-[2.75rem]">
              {isLoading ? (
                <Skeleton className="h-9 w-44" />
              ) : (
                <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                  {isBalanceVisible
                    ? currencyFormatter.format(balance ?? 0)
                    : "•••••••"}
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={card.status} withIcon />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <DetailRow icon={Hash} label="Account No" value={card.accountNumber} />
            <DetailRow
              icon={Network}
              label="Card Network"
              value={card.cardTypeNetwork}
            />
            <DetailRow icon={CreditCard} label="Type" value={card.type} />
            <DetailRow icon={Banknote} label="Currency" value={card.currency} />
          </div>
        </div>

        <div className="space-y-3">
          {hasPendingCardRequest ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-warning/25 bg-warning-muted px-3 py-2.5 text-sm text-warning-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              Your card request is waiting for approval.
            </div>
          ) : canRequestNewCard && accountNumber ? (
            <Button className="w-full" asChild>
              <Link
                href={`/request-card?accountNumber=${encodeURIComponent(accountNumber)}`}
              >
                <Plus />
                Request New Card
              </Link>
            </Button>
          ) : !allowSelfRequest && accountNumber ? (
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Self-service requests are turned off. Contact support to request
              another card.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/limits?card_numb=${card.fullNumber}`} prefetch={false}>
                <ShieldCheck />
                Manage Limits
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link
                href={`/change-pin?card_numb=${card.fullNumber}`}
                prefetch={false}
              >
                <KeyRound />
                Change PIN
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
