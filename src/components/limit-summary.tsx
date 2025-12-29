
"use client";

import { Skeleton } from "./ui/skeleton";
import { type LimitApiResponse } from "@/app/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "./ui/card";

type LimitSummaryProps = {
  allLimits: LimitApiResponse[];
  isLoading: boolean;
};

type GroupedLimit = {
    transaction_type: string;
    periodicity_id: string;
    limit: number;
}

export default function LimitSummary({ allLimits, isLoading }: LimitSummaryProps) {
  
  const currencyFormatter = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

  const groupedLimits = allLimits.reduce((acc, limit) => {
    if (!acc[limit.transaction_type]) {
      acc[limit.transaction_type] = {
        periodicity_id: limit.periodicity_id,
        limits: [],
      };
    }
    acc[limit.transaction_type].limits.push(limit.mnt_limite);
    return acc;
  }, {} as Record<string, { periodicity_id: string, limits: number[] }>);

  const summary: GroupedLimit[] = Object.entries(groupedLimits).map(([transaction_type, data]) => ({
    transaction_type,
    periodicity_id: data.periodicity_id,
    limit: Math.min(...data.limits),
  }));


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
        {/* Desktop View */}
        <div className="hidden md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Transaction Type</TableHead>
                        <TableHead>Periodicity</TableHead>
                        <TableHead className="text-right">Limit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? renderDesktopSkeleton() : (
                      summary.map((limit, index) => (
                            <TableRow key={`${limit.transaction_type}-${index}`}>
                                <TableCell className="text-sm text-muted-foreground">{limit.transaction_type}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{limit.periodicity_id}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {currencyFormatter(limit.limit)}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
        {/* Mobile View */}
        <div className="md:hidden p-2 space-y-2">
             {isLoading ? renderMobileSkeleton() : (
                summary.map((limit, index) => (
                    <Card key={`${limit.transaction_type}-${index}`} className="bg-muted/30">
                        <CardContent className="p-3">
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p className="font-semibold text-base text-foreground mb-2">{limit.transaction_type}</p>
                                <div className="flex justify-between">
                                    <p>Periodicity:</p>
                                    <p>{limit.periodicity_id}</p>
                                </div>
                                <div className="flex justify-between border-t pt-2 mt-2">
                                    <p className="font-medium text-foreground">Limit:</p>
                                    <p className="font-semibold text-foreground">{currencyFormatter(limit.limit)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
      </div>
  );
}
