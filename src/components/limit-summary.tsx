
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
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";

type LimitSummaryProps = {
  allLimits: LimitApiResponse[];
  isLoading: boolean;
};

export default function LimitSummary({ allLimits, isLoading }: LimitSummaryProps) {
  
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const uniqueLimits = allLimits
    .filter(limit => ['POS CHANNEL', 'ATM CHANNEL'].includes(limit.channel))
    .reduce((acc, current) => {
      const key = `${current.channel}-${current.transaction_type}-${current.mnt_limite}-${current.periodicity_id}-${current.risk_code}`;
      if (!acc.find(item => `${item.channel}-${item.transaction_type}-${item.mnt_limite}-${item.periodicity_id}-${item.risk_code}` === key)) {
        acc.push(current);
      }
      return acc;
    }, [] as LimitApiResponse[])
    .sort((a, b) => a.channel.localeCompare(b.channel));

    const renderDesktopSkeleton = () => (
      Array.from({ length: 5 }).map((_, index) => (
          <TableRow key={index}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
          </TableRow>
      ))
    );

    const renderMobileSkeleton = () => (
       Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="space-y-2 text-sm">
                       <div className="flex justify-between">
                          <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-4 w-2/3" />
                       </div>
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-4 w-1/3" />
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
        <ScrollArea className="h-[300px] rounded-md border">
            {/* Desktop View */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Channel</TableHead>
                            <TableHead>Transaction Type</TableHead>
                            <TableHead>Periodicity</TableHead>
                            <TableHead>Risk Code</TableHead>
                            <TableHead className="text-right">Limit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? renderDesktopSkeleton() : (
                          uniqueLimits.map((limit, index) => (
                                <TableRow key={`${limit.risk_code}-${index}`}>
                                    <TableCell>
                                      <Badge variant={limit.channel === 'POS CHANNEL' ? 'secondary' : 'outline'} className="font-mono text-xs">
                                        {limit.channel}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{limit.transaction_type}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{limit.periodicity_id}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{limit.risk_code}</TableCell>
                                    <TableCell className="text-right font-medium">{currencyFormatter.format(limit.mnt_limite)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {/* Mobile View */}
            <div className="md:hidden p-2 space-y-2">
                 {isLoading ? renderMobileSkeleton() : (
                    uniqueLimits.map((limit, index) => (
                        <Card key={`${limit.risk_code}-${index}`} className="bg-muted/30">
                            <CardContent className="p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <Badge variant={limit.channel === 'POS CHANNEL' ? 'secondary' : 'outline'} className="font-mono text-xs">
                                        {limit.channel}
                                    </Badge>
                                    <p className="font-semibold text-base">{currencyFormatter.format(limit.mnt_limite)}</p>
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    <div className="flex justify-between">
                                        <p className="font-medium text-foreground">Type:</p>
                                        <p className="text-right">{limit.transaction_type}</p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p>Periodicity:</p>
                                        <p>{limit.periodicity_id}</p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p>Risk Code:</p>
                                        <p>{limit.risk_code}</p>
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
