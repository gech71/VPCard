"use client";

import { useState } from "react";
import { Skeleton } from "./ui/skeleton";
import { type LimitApiResponse, setCardLimit } from "@/app/actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, ArrowRight, ShieldCheck } from "lucide-react";

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

export default function LimitSummary({ allLimits, isLoading, onUpdate }: LimitSummaryProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [newLimits, setNewLimits] = useState<Record<string, string>>({});
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

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>, limitData: LimitApiResponse) => {
    e.preventDefault();
    setPending(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const result = await setCardLimit(null, formData);
      
      toast({
        title: result.success ? "Success" : "Error",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      if (result.success) {
        setActiveAccordionItem(null); // Close accordion
        const key = `${limitData.transaction_type}-${limitData.periodicity_id}`;
        setNewLimits(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        onUpdate(); // Trigger re-fetch
      }
    } catch (error) {
      console.error("Limit update error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred while updating the limit.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setNewLimits(prev => ({
      ...prev,
      [key]: value
    }));
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
          summary.map((limit) => {
            const key = `${limit.transaction_type}-${limit.periodicity_id}`;
            const data = limit.originalData;
            return (
              <AccordionItem value={data.risk_code} key={data.risk_code} className="border rounded-md bg-muted/30 overflow-hidden">
                <AccordionTrigger className="p-4 hover:no-underline text-left group">
                  <div className="w-full flex items-center justify-between pr-4">
                    <div className="space-y-1">
                      <p className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{limit.transaction_type}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        <span>{data.channel}</span>
                        <span>•</span>
                        <span>{data.periodicity_id}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Limit</p>
                      <p className="font-mono text-xl font-bold text-primary">{currencyFormatter(limit.limit)}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 bg-background/50 border-t">
                  <form onSubmit={(e) => handleFormSubmit(e, data)} className="space-y-6">
                    {/* Individual hidden fields instead of a JSON blob to avoid WAF issues (SSRF detection) */}
                    <input type="hidden" name="risk_code" value={data.risk_code} />
                    <input type="hidden" name="transaction_type" value={data.transaction_type} />
                    <input type="hidden" name="channel" value={data.channel} />
                    <input type="hidden" name="periodicity_id" value={data.periodicity_id} />
                    <input type="hidden" name="periodicity_code" value={data.periodicity_code} />
                    <input type="hidden" name="domain_type" value={data.domain_type} />
                    <input type="hidden" name="transaction_mode" value={data.transaction_mode} />
                    <input type="hidden" name="tans_max" value={data.tans_max} />
                    <input type="hidden" name="limite_number" value={data.limite_number} />
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <label htmlFor={`newLimit-${key}`} className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                          Enter New Limit
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                          <Input
                              id={`newLimit-${key}`}
                              name="newLimit"
                              type="number"
                              placeholder="0"
                              required
                              value={newLimits[key] || ""}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                              className="pl-7 h-12 text-lg font-mono font-bold border-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        disabled={pending} 
                        className="h-12 px-8 font-bold shadow-md hover:shadow-lg transition-all"
                      >
                        {pending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </div>
                  </form>
                </AccordionContent>
              </AccordionItem>
            );
          })
        )}
      </Accordion>
    </div>
  );
}
