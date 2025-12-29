
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
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";

type LimitSummaryProps = {
  allLimits: LimitApiResponse[];
  isLoading: boolean;
};

type GroupedLimit = {
    transaction_type: string;
    periodicity_id: string;
    current: number;
    max: number;
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
        maxes: []
      };
    }
    acc[limit.transaction_type].limits.push(limit.mnt_limite);
    acc[limit.transaction_type].maxes.push(limit.tans_max);
    return acc;
  }, {} as Record<string, { periodicity_id: string, limits: number[], maxes: number[] }>);

  const summary: GroupedLimit[] = Object.entries(groupedLimits).map(([transaction_type, data]) => ({
    transaction_type,
    periodicity_id: data.periodicity_id,
    current: Math.min(...data.limits),
    max: Math.max(...data.maxes)
  }));


    const renderDesktopSkeleton = () => (
      Array.from({ length: 5 }).map((_, index) => (
          <TableRow key={index}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-full" /></TableCell>
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
        <h3 className="font-medium">All Limits</h3>
        <ScrollArea className="h-[400px] rounded-md border">
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
                                    <TableCell className="text-right font-medium w-[200px]">
                                      <div className="flex flex-col items-end">
                                        <span>{currencyFormatter(limit.current)} / {currencyFormatter(limit.max)}</span>
                                        <Progress value={(limit.current / limit.max) * 100} className="h-2 mt-1" />
                                      </div>
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
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-semibold text-base text-foreground">{limit.transaction_type}</p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p>Periodicity:</p>
                                        <p>{limit.periodicity_id}</p>
                                    </div>
                                     <div className="flex flex-col">
                                        <div className="flex justify-between font-medium text-foreground">
                                            <span>Current: {currencyFormatter(limit.current)}</span>
                                            <span>Max: {currencyFormatter(limit.max)}</span>
                                        </div>
                                        <Progress value={(limit.current / limit.max) * 100} className="h-2 mt-1" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </ScrollArea>
      </div>
  );
}
