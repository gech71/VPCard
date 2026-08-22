"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CircleDollarSign, Loader2, Save, Wallet } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FeeConfig = {
  paymentRequired: boolean;
  active: boolean;
  amount: number;
  currency: string;
  paymentEnforced: boolean;
};

/** Currencies the fee may be denominated in. ETB is the only one in use today. */
const CURRENCIES = ["ETB"] as const;

export default function CardRequestFeeSettings() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState<string>("ETB");
  const [saved, setSaved] = useState<FeeConfig | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/admin/card-request-fee");
      const data = await res.json();

      if (res.ok) {
        apply(data.config);
      }
    } catch {
      /* falls back to the defaults below */
    } finally {
      setLoading(false);
    }
  }

  function apply(config: FeeConfig) {
    setPaymentRequired(config.paymentRequired);
    setActive(config.active);
    setAmount(String(config.amount ?? 0));
    setCurrency(config.currency || "ETB");
    setSaved(config);
  }

  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= 0;
  // Mirrors the server rule in getCardRequestFeeConfig - both switches on and a
  // positive amount, or Guests are not charged.
  const wouldEnforce = paymentRequired && active && amountValid && parsedAmount > 0;

  const dirty =
    saved !== null &&
    (saved.paymentRequired !== paymentRequired ||
      saved.active !== active ||
      saved.amount !== parsedAmount ||
      saved.currency !== currency);

  async function handleSave() {
    if (!amountValid) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Enter the fee as a number, for example 100.",
      });
      return;
    }

    if (paymentRequired && active && parsedAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Set a fee first",
        description:
          "Enter an amount greater than zero, or switch Payment Required off.",
      });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/card-request-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentRequired,
          active,
          amount: parsedAmount,
          currency,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Not saved",
          description: data.error || "Failed to save the card request fee",
        });
        return;
      }

      apply(data.config);
      toast({
        title: "Card request fee updated",
        description: data.config.paymentEnforced
          ? `Guests must now pay ${data.config.amount} ${data.config.currency}.`
          : "Guest card requests are now free of charge.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
            <CircleDollarSign className="h-4 w-4" />
          </span>
          <div className="space-y-0.5">
            <CardTitle>Card request fee</CardTitle>
            <CardDescription>
              Charge Guests a fee before they can submit a card request. Makers
              are never charged, under any configuration.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Current state, stated in plain words. */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 transition-colors",
            wouldEnforce
              ? "border-warning/25 bg-warning-muted"
              : "border-success/25 bg-success-muted",
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              wouldEnforce
                ? "bg-warning/15 text-warning"
                : "bg-success/15 text-success",
            )}
          >
            {wouldEnforce ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )}
          </span>
          <div className="space-y-0.5">
            <p
              className={cn(
                "text-sm font-semibold",
                wouldEnforce
                  ? "text-warning-muted-foreground"
                  : "text-success-muted-foreground",
              )}
            >
              {wouldEnforce
                ? `ON — Guests must pay ${parsedAmount} ${currency}`
                : "OFF — Card requests are free"}
            </p>
            <p
              className={cn(
                "text-sm leading-relaxed",
                wouldEnforce
                  ? "text-warning-muted-foreground/90"
                  : "text-success-muted-foreground/90",
              )}
            >
              {wouldEnforce
                ? "Guests see a payment screen and must pay before reaching the card request form."
                : paymentRequired && !active
                  ? "Payment Required is on, but the fee is Inactive — Guests are not charged."
                  : "Guests go straight to the card request form."}
              {dirty ? " Not saved yet." : ""}
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
          <div className="space-y-1">
            <Label htmlFor="paymentRequired" className="text-base">
              Payment required
            </Label>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The master switch. When off, Guest card requests are completely
              free and the fee below is ignored.
            </p>
          </div>
          <Switch
            id="paymentRequired"
            checked={paymentRequired}
            onCheckedChange={setPaymentRequired}
            className="mt-1 shrink-0"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="feeAmount">Card request fee</Label>
            <Input
              id="feeAmount"
              inputMode="decimal"
              value={amount}
              disabled={saving}
              aria-invalid={!amountValid ? true : undefined}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              className="font-mono"
            />
            {!amountValid && (
              <p className="text-sm font-medium text-destructive">
                Enter a number, for example 100.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeCurrency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="feeCurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
          <div className="space-y-1">
            <Label htmlFor="feeActive" className="text-base">
              Status
            </Label>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set the fee Inactive to park it without losing the amount. An
              inactive fee is not charged even when Payment Required is on.
            </p>
          </div>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {active ? "Active" : "Inactive"}
            </span>
            <Switch id="feeActive" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" />
                Saving&hellip;
              </>
            ) : (
              <>
                <Save />
                Save fee settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
