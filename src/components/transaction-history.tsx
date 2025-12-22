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

type TransactionHistoryProps = {
  transactions: Transaction[];
};

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
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

  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <CardTitle className="font-headline">Transaction History</CardTitle>
        </div>
        <CardDescription>Your last {transactions.length} transactions.</CardDescription>
      </CardHeader>
      <CardContent>
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
              {transactions.map((tx) => (
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
      </CardContent>
    </Card>
  );
}
