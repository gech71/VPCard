
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import type { Transaction } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";

type TransactionHistoryProps = {
  transactions: Transaction[];
  isLoading: boolean;
};

export default function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  const getStatusVariant = (status: Transaction['status']) => {
    switch (status) {
      case 'Completed':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const renderSkeleton = (isMobile: boolean) => (
    Array.from({ length: 5 }).map((_, index) => (
      isMobile ? (
        <div key={index} className="flex items-center justify-between p-2 border-b">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      ) : (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
        </TableRow>
      )
    ))
  );

  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <CardTitle className="font-headline">Transaction History</CardTitle>
        </div>
        <CardDescription>Your last transactions for the selected card.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block">
            <ScrollArea className="h-[420px]">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? renderSkeleton(false) : transactions.map((tx) => (
                    <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>
                        <Badge variant={getStatusVariant(tx.status)}>{tx.status}</Badge>
                    </TableCell>
                    <TableCell
                        className={cn(
                        "text-right font-semibold",
                        tx.amount > 0 ? "text-green-600" : "text-foreground"
                        )}
                    >
                        {tx.amount > 0 ? "+" : ""}
                        {currencyFormatter.format(tx.amount)}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </ScrollArea>
        </div>

        <div className="md:hidden">
            <ScrollArea className="h-[420px]">
                <div className="space-y-4">
                {isLoading ? renderSkeleton(true) : transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-2 border-b">
                    <div className="flex flex-col gap-1">
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-sm text-muted-foreground">{tx.date}</p>
                        <Badge variant={getStatusVariant(tx.status)} className="w-fit">{tx.status}</Badge>
                    </div>
                    <p
                        className={cn(
                        "font-semibold",
                        tx.amount > 0 ? "text-green-600" : "text-foreground"
                        )}
                    >
                        {tx.amount > 0 ? "+" : ""}
                        {currencyFormatter.format(tx.amount)}
                    </p>
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>

      </CardContent>
    </Card>
  );
}
