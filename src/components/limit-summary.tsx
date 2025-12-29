
"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Skeleton } from "./ui/skeleton";
import { type LimitApiResponse, setCardLimit } from "@/app/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "./ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type LimitSummaryProps = {
  allLimits: LimitApiResponse[];
  isLoading: boolean;
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


export default function LimitSummary({ allLimits, isLoading }: LimitSummaryProps) {
  const { toast } = useToast();
  const [formState, formAction] = useFormState(setCardLimit, initialSetLimitState);
  const [pending, setPending] = useState(false);
  const [newLimit, setNewLimit] = useState<number | string>("");

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
  };

  const renderDesktopSkeleton = () => (
    Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={index}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-4 w-24" /></TableCell>
      </TableRow>
    ))
  );

  const renderMobileSkeleton = () => (
    Array.from({ length: 3 }).map((_, index) => (
      <Card key={index} className="bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-6 w-28" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))
  );

  return (
    <div className="py-4 space-y-4">
      <Accordion type="single" collapsible className="w-full space-y-2">
        {isLoading ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableBody>{renderDesktopSkeleton()}</TableBody>
              </Table>
            </div>
            <div className="md:hidden p-2 space-y-2">{renderMobileSkeleton()}</div>
          </>
        ) : (
          summary.map((limit) => (
            <AccordionItem value={limit.originalData.risk_code} key={limit.originalData.risk_code} className="border rounded-md bg-muted/30">
              <AccordionTrigger className="p-3 hover:no-underline">
                <div className="w-full text-left">
                  <p className="font-semibold text-base text-foreground mb-2">{limit.transaction_type}</p>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <p>Periodicity:</p>
                    <p>{limit.periodicity_id}</p>
                  </div>
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
