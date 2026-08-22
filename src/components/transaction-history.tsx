'use client';

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { History, Receipt, Search, SearchX } from "lucide-react";
import type { Transaction } from "@/lib/data";
import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/use-pagination";
import DataPagination from "./data-pagination";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";
import TableSkeleton from "./table-skeleton";
import { Skeleton } from "./ui/skeleton";

type TransactionHistoryProps = {
  transactions: Transaction[];
  isLoading: boolean;
};

function formatTransactionAmount(amount: number, currencyCode: string): string {
  const code = currencyCode?.trim() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    const sign = amount > 0 ? "+" : "";
    return `${sign}${code} ${Math.abs(amount).toFixed(2)}`;
  }
}

export default function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  const [query, setQuery] = useState("");

  // Presentation-only filter across the rows already loaded for this card.
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter(
      (tx) =>
        tx.description?.toLowerCase().includes(term) ||
        tx.date?.toLowerCase().includes(term) ||
        tx.status?.toLowerCase().includes(term),
    );
  }, [transactions, query]);

  const pagination = usePagination(filtered, 10);
  const { pageItems } = pagination;

  const hasTransactions = transactions.length > 0;
  const noResults = hasTransactions && filtered.length === 0;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
            <History className="h-5 w-5" />
          </span>
          <div className="space-y-0.5">
            <CardTitle className="font-headline">Transaction History</CardTitle>
            <CardDescription>
              Your last transactions for the selected card.
            </CardDescription>
          </div>
        </div>

        {hasTransactions && !isLoading ? (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transactions"
              aria-label="Search transactions"
              className="h-9 pl-9"
            />
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeleton
                    columns={4}
                    widths={[
                      "h-4 w-24",
                      "h-4 w-full max-w-[16rem]",
                      "h-5 w-20 rounded-full",
                      "h-4 w-20 ml-auto",
                    ]}
                  />
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="divide-y divide-border md:hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </>
        ) : !hasTransactions ? (
          <EmptyState
            icon={Receipt}
            title="No transactions"
            description="No recent transactions were found for this card."
          />
        ) : noResults ? (
          <EmptyState
            icon={SearchX}
            title="No matching transactions"
            description={`Nothing matches “${query}”. Try a different search term.`}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[10rem]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[8rem]">Status</TableHead>
                    <TableHead className="w-[10rem] text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {tx.date}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-semibold tabular-nums",
                          tx.amount > 0 ? "text-success" : "text-foreground",
                        )}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {formatTransactionAmount(tx.amount, tx.currencyCode)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {pageItems.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="truncate font-medium text-foreground">
                      {tx.description}
                    </p>
                    <p className="text-sm text-muted-foreground">{tx.date}</p>
                    <StatusBadge status={tx.status} className="w-fit" />
                  </div>
                  <p
                    className={cn(
                      "shrink-0 whitespace-nowrap font-semibold tabular-nums",
                      tx.amount > 0 ? "text-success" : "text-foreground",
                    )}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatTransactionAmount(tx.amount, tx.currencyCode)}
                  </p>
                </div>
              ))}
            </div>

            <DataPagination
              pagination={pagination}
              itemLabel="transactions"
              pageSizeOptions={[10, 25, 50]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
