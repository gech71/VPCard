
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
      const key = `${current.channel}-${current.transaction_type}-${current.mnt_limite}`;
      if (!acc.find(item => `${item.channel}-${item.transaction_type}-${item.mnt_limite}` === key)) {
        acc.push(current);
      }
      return acc;
    }, [] as LimitApiResponse[])
    .sort((a, b) => a.channel.localeCompare(b.channel));


  return (
    <div className="py-4 space-y-4">
        <h3 className="font-medium">All Limits</h3>
        <ScrollArea className="h-[300px] rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Transaction Type</TableHead>
                        <TableHead className="text-right">Limit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                            <TableRow key={index}>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                            </TableRow>
                        ))
                    ) : (
                       uniqueLimits.map((limit) => (
                            <TableRow key={limit.risk_code}>
                                <TableCell>
                                  <Badge variant={limit.channel === 'POS CHANNEL' ? 'secondary' : 'outline'}>
                                    {limit.channel}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{limit.transaction_type}</TableCell>
                                <TableCell className="text-right font-medium">{currencyFormatter.format(limit.mnt_limite)}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
      </div>
  );
}
