"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CircleX,
  Clock,
  Download,
  Eye,
  Filter,
  Loader2,
  Search,
  SearchX,
  Wallet,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import PaymentDetailDialog from "@/components/payment-detail-dialog";
import type { AdminPayment, PaymentSummary } from "@/lib/payment-history";
import { PAYMENT_CSV_HEADERS, toPaymentCsvRow } from "@/lib/payment-history";

const EMPTY_FILTERS = {
  status: "all",
  usage: "all",
  phoneNumber: "",
  reference: "",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
};

type Filters = typeof EMPTY_FILTERS;

function AdminPaymentsContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null);

  // The URL is the source of truth for what is on screen, so a filtered view
  // can be bookmarked and shared with another Super Admin.
  const [filters, setFilters] = useState<Filters>(() => ({
    status: searchParams.get("status") ?? "all",
    usage: searchParams.get("usage") ?? "all",
    phoneNumber: searchParams.get("phoneNumber") ?? "",
    reference: searchParams.get("reference") ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    minAmount: searchParams.get("minAmount") ?? "",
    maxAmount: searchParams.get("maxAmount") ?? "",
  }));

  const queryString = searchParams.toString();

  const fetchPayments = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/payments?${queryString}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load payment history");
      }

      setPayments(data.payments ?? []);
      setSummary(data.summary ?? null);
      setTruncated(Boolean(data.truncated));
      setTotal(data.total ?? 0);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load payment history",
      });
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      // "all" is the absence of a filter, not a value to send.
      if (value && value !== "all") params.set(key, value);
    }

    router.push(`/admin/payments?${params.toString()}`);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    router.push("/admin/payments");
  }

  /** Only meaningful when every row shares one currency, which is the norm. */
  const currency = useMemo(() => {
    const seen = new Set(payments.map((p) => p.currency));
    return seen.size === 1 ? [...seen][0] : "";
  }, [payments]);

  const money = useCallback(
    (value: number) =>
      `${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency}` : ""}`,
    [currency],
  );

  const [exporting, setExporting] = useState(false);

  async function exportToCSV() {
    if (payments.length === 0) return;

    // The table shows a window onto the results; an export that quietly
    // matched it would hand someone an incomplete ledger. Fetch the rest first.
    let rows = payments;

    if (truncated) {
      setExporting(true);
      try {
        const res = await fetch(`/api/admin/payments?${queryString}&limit=5000`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to export payments");

        rows = data.payments ?? payments;

        if (data.truncated) {
          toast({
            title: "Export is capped",
            description: `Exporting the ${rows.length} most recent of ${data.total} matching payments. Narrow the date range to export the rest.`,
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Export failed",
          description:
            error instanceof Error ? error.message : "Failed to export payments",
        });
        return;
      } finally {
        setExporting(false);
      }
    }

    const csv = [PAYMENT_CSV_HEADERS, ...rows.map(toPaymentCsvRow)]
      .map((row) =>
        row
          // Quote every field: names and failure reasons contain commas, and an
          // unquoted one silently shifts every later column.
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `card_request_payments_${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const pagination = usePagination(payments, 25);
  const activeFilterCount = Array.from(searchParams.keys()).length;

  return (
    <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Payment history"
        description="Every card-request fee payment opened with the bank, what became of it, and whether the Guest went on to use it."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
            >
              <Filter />
              {showFilters ? "Hide filters" : "Show filters"}
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void exportToCSV()}
              disabled={payments.length === 0 || exporting}
            >
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              Export CSV
            </Button>
          </>
        }
      />

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={money(summary?.collected ?? 0)}
          icon={Wallet}
          tone="success"
          hint={`${summary?.counts.SUCCESS ?? 0} successful payment${
            summary?.counts.SUCCESS === 1 ? "" : "s"
          }`}
          isLoading={loading}
        />
        <StatCard
          label="Awaiting confirmation"
          value={summary?.counts.PENDING ?? 0}
          icon={Clock}
          tone="warning"
          hint={money(summary?.totals.PENDING ?? 0)}
          isLoading={loading}
        />
        <StatCard
          label="Failed or cancelled"
          value={
            (summary?.counts.FAILED ?? 0) + (summary?.counts.CANCELLED ?? 0)
          }
          icon={CircleX}
          tone="danger"
          hint="Nothing was collected"
          isLoading={loading}
        />
        <StatCard
          label="Paid, not used"
          value={summary?.unspentCount ?? 0}
          icon={Wallet}
          tone="info"
          hint={`${money(summary?.unspentTotal ?? 0)} — no card request yet`}
          isLoading={loading}
        />
      </div>

      {showFilters && (
        <Card className="animate-fade-in-down">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Advanced filters</CardTitle>
            <CardDescription>
              Narrow the list down, then apply to refresh the results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilter("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="SUCCESS">Successful</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage">Used for a card request</Label>
                <Select
                  value={filters.usage}
                  onValueChange={(value) => setFilter("usage", value)}
                >
                  <SelectTrigger id="usage">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="spent">Used for a request</SelectItem>
                    <SelectItem value="unspent">Not used yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Guest phone number</Label>
                <Input
                  id="phoneNumber"
                  value={filters.phoneNumber}
                  onChange={(e) => setFilter("phoneNumber", e.target.value)}
                  placeholder="251…"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={filters.reference}
                  onChange={(e) => setFilter("reference", e.target.value)}
                  placeholder="Transaction id, bank ref or payer"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilter("startDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilter("endDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minAmount">Minimum amount</Label>
                <Input
                  id="minAmount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={filters.minAmount}
                  onChange={(e) => setFilter("minAmount", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAmount">Maximum amount</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={filters.maxAmount}
                  onChange={(e) => setFilter("maxAmount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={clearFilters}>
                <X />
                Clear
              </Button>
              <Button onClick={applyFilters}>
                <Search />
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader>
          <CardTitle>Fee payments</CardTitle>
          <CardDescription>
            {loading
              ? "Loading payments…"
              : truncated
                ? `Showing the ${payments.length} most recent of ${total} matching payments. Narrow the filters to see the rest.`
                : `${total} payment${total === 1 ? "" : "s"}${
                    activeFilterCount > 0 ? " matching these filters" : ""
                  }.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Started</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>References</TableHead>
                  <TableHead>Card request</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton columns={7} rows={8} />
              </TableBody>
            </Table>
          ) : total === 0 && activeFilterCount === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments yet"
              description="Card-request fee payments will appear here once Guests start paying."
            />
          ) : payments.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching payments"
              description="Nothing matches these filters. Try widening the date range or clearing the search."
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <Table
                containerClassName="max-h-[40rem] overflow-y-auto"
                className="table-sticky-head"
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[11rem]">Started</TableHead>
                    <TableHead className="min-w-[10rem]">Guest</TableHead>
                    <TableHead className="min-w-[9rem]">Amount</TableHead>
                    <TableHead className="min-w-[9rem]">Status</TableHead>
                    <TableHead className="min-w-[14rem]">References</TableHead>
                    <TableHead className="min-w-[12rem]">Card request</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((payment) => (
                    <TableRow
                      key={payment.id}
                      className="cursor-pointer align-top"
                      onClick={() => setOpenPaymentId(payment.id)}
                    >
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleString()}
                        {payment.paidAt && (
                          <span className="mt-0.5 block text-xs text-success-muted-foreground">
                            Paid {new Date(payment.paidAt).toLocaleString()}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-sm text-foreground">
                          {payment.phoneNumber}
                        </span>
                        {payment.paidByNumber &&
                          payment.paidByNumber !== payment.phoneNumber && (
                            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                              Paid by {payment.paidByNumber}
                            </span>
                          )}
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {payment.amount.toFixed(2)} {payment.currency}
                        </span>
                        {payment.paidAmount &&
                          Number(payment.paidAmount) !== payment.amount && (
                            <span className="mt-0.5 block font-mono text-xs text-warning-muted-foreground">
                              Bank reported {payment.paidAmount}
                            </span>
                          )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={payment.status} withIcon />
                        {payment.failureReason && (
                          <span className="mt-1 block max-w-[12rem] text-xs text-muted-foreground">
                            {payment.failureReason}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          Ours: {payment.transactionId}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                          Bank: {payment.txnRef || "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        {payment.cardRequest ? (
                          <Link
                            href={`/admin/requests?accountNumber=${encodeURIComponent(
                              payment.cardRequest.accountNumber,
                            )}`}
                            onClick={(e) => e.stopPropagation()}
                            className="group flex flex-col gap-1"
                          >
                            <span className="truncate text-sm font-medium text-foreground group-hover:underline">
                              {payment.cardRequest.customerName}
                            </span>
                            <StatusBadge
                              status={payment.cardRequest.status}
                              className="w-fit"
                            />
                          </Link>
                        ) : payment.status === "SUCCESS" ? (
                          <span className="text-sm text-warning-muted-foreground">
                            Paid, not used yet
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View payment ${payment.transactionId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPaymentId(payment.id);
                          }}
                        >
                          <Eye />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataPagination
                pagination={pagination}
                itemLabel="payments"
                pageSizeOptions={[25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <PaymentDetailDialog
        paymentId={openPaymentId}
        onOpenChange={(open) => {
          if (!open) setOpenPaymentId(null);
        }}
      />
    </main>
  );
}

function AdminPaymentsFallback() {
  return (
    <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </main>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<AdminPaymentsFallback />}>
      <AdminPaymentsContent />
    </Suspense>
  );
}
