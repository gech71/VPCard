
"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Skeleton } from "./ui/skeleton";
import { type LimitApiResponse, setCardLimit } from "@/app/actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
  const [formState, formAction] = useFormState(setCardLimit, initialSetLimitState);
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
      <div key={index} className="border rounded-md p-3 bg-muted/30">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ))
  );

  return (
    <div className="py-4 space-y-4">
      <Accordion 
        type="single" 
        collapsible 
        className="w-full space-y-2"
        value={activeAccordionItem ?? undefined}
        onValueChange={(value) => setActiveAccordionItem(value)}
      >
        {isLoading ? (
          renderSkeleton()
        ) : (
          summary.map((limit) => (
            <AccordionItem value={limit.originalData.risk_code} key={limit.originalData.risk_code} className="border rounded-md bg-muted/30">
              <AccordionTrigger className="p-3 hover:no-underline text-left">
                <div className="w-full">
                  <p className="font-semibold text-base text-foreground mb-2">{limit.transaction_type}</p>
                   <div className="flex justify-between border-t pt-2 mt-2 text-sm">
                    <p className="font-medium text-foreground">Limit:</p>
                    <p className="font-semibold text-foreground">{currencyFormatter(limit.limit)}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 border-t">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <input type="hidden" name="limitData" value={JSON.stringify(limit.originalData)} />
                  <div>
                    <label htmlFor="newLimit" className="block text-sm font-medium text-foreground mb-1">Set New Limit</label>
                    <Input
                        id="newLimit"
                        name="newLimit"
                        type="number"
                        placeholder="Enter new limit amount"
                        required
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        className="max-w-xs"
                    />
                  </div>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
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
