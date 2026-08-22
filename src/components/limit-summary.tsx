"use client";

import { useState, useActionState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";

import { type LimitApiResponse, setCardLimit } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "./empty-state";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";

type LimitSummaryProps = {
  allLimits: LimitApiResponse[];
  isLoading: boolean;
  onUpdate: () => void;
};

type GroupedLimit = {
    transaction_type: string;
    periodicity_id: string;
    limit: number;
    originalData: LimitApiResponse;
}

const initialSetLimitState = {
  success: false,
  message: "",
};


export default function LimitSummary({ allLimits, isLoading, onUpdate }: LimitSummaryProps) {
  const { toast } = useToast();
  const [formState, formAction] = useActionState(setCardLimit, initialSetLimitState);
  const [pending, setPending] = useState(false);
  const [newLimit, setNewLimit] = useState<number | string>("");
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | null>(null);

  const currencyFormatter = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

  const groupedLimits = allLimits.reduce((acc, limit) => {
    const key = `${limit.transaction_type}-${limit.periodicity_id}`;
    if (!acc[key] || limit.mnt_limite < acc[key].limit) {
      acc[key] = {
        transaction_type: limit.transaction_type,
        periodicity_id: limit.periodicity_id,
        limit: limit.mnt_limite,
        originalData: limit
      };
    }
    return acc;
  }, {} as Record<string, GroupedLimit>);

  const summary: GroupedLimit[] = Object.values(groupedLimits).sort((a,b) => a.transaction_type.localeCompare(b.transaction_type));

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await setCardLimit(formState, formData);
    toast({
      title: result.success ? "Success" : "Error",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
    setPending(false);
    if (result.success) {
      setActiveAccordionItem(null); // Close accordion
      onUpdate(); // Trigger re-fetch
    }
  };

  const renderSkeleton = () => (
    Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <Skeleton className="h-5 w-2/5" />
        <div className="flex items-center justify-between border-t border-border/70 pt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    ))
  );

  if (!isLoading && summary.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="No limits configured"
        description="There are no transaction limits available for this channel."
        compact
      />
    );
  }

  return (
    <div className="space-y-3 py-2">
      <Accordion
        type="single"
        collapsible
        className="w-full space-y-3"
        value={activeAccordionItem ?? undefined}
        onValueChange={(value) => setActiveAccordionItem(value)}
      >
        {isLoading ? (
          renderSkeleton()
        ) : (
          summary.map((limit) => (
            <AccordionItem
              value={limit.originalData.risk_code}
              key={limit.originalData.risk_code}
              className="overflow-hidden rounded-lg border border-border bg-card transition-colors data-[state=open]:border-primary/40 data-[state=open]:bg-muted/30"
            >
              <AccordionTrigger className="px-4 py-3.5 text-left hover:no-underline">
                <div className="w-full min-w-0 space-y-2 pr-2">
                  <p className="truncate text-base font-semibold text-foreground">
                    {limit.transaction_type}
                  </p>
                  <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2">
                    <span className="text-sm text-muted-foreground">Limit</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {currencyFormatter(limit.limit)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t border-border bg-background px-4 pb-4 pt-4">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <input type="hidden" name="limitData" value={JSON.stringify(limit.originalData)} />
                  <div className="space-y-2">
                    <Label htmlFor={`newLimit-${limit.originalData.risk_code}`}>
                      Set new limit
                    </Label>
                    <Input
                        id={`newLimit-${limit.originalData.risk_code}`}
                        name="newLimit"
                        type="number"
                        inputMode="numeric"
                        placeholder="Enter new limit amount"
                        required
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        className="max-w-xs tabular-nums"
                    />
                    <p className="text-xs text-muted-foreground">
                      Current limit: {currencyFormatter(limit.limit)}
                    </p>
                  </div>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="animate-spin" />}
                    Save changes
                  </Button>
                </form>
              </AccordionContent>
            </AccordionItem>
          ))
        )}
      </Accordion>
    </div>
  );
}
