"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import { CreditCard, Download, Filter, Search, X } from "lucide-react";

interface CardRequest {
  id: string;
  accountNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  pan: string | null;
  expiryDate: string | null;
  maker: { email: string };
  checker: { email: string } | null;
  /** Terms & Conditions acceptance recorded when this request was submitted. */
  termsAccepted: boolean;
  termsVersionNo: number | null;
  termsAcceptedAt: string | null;
}

/**
 * How the acceptance reads on screen. A request submitted before any terms were
 * published is not a refusal - there was nothing to accept - so it is labelled
 * distinctly rather than as a failure to agree.
 */
function termsRecord(req: CardRequest) {
  if (req.termsAccepted) {
    return {
      label:
        req.termsVersionNo !== null
          ? `Accepted · v${req.termsVersionNo}`
          : "Accepted",
      tone: "success" as const,
      at: req.termsAcceptedAt,
    };
  }

  return {
    label: "No terms in force",
    tone: "neutral" as const,
    at: null,
  };
}

// Helper to mask PAN for display
function maskPan(pan: string | null): string {
  if (!pan) return '';
  // If encrypted (contains colons), show masked
  if (pan.includes(':')) {
    return '•••• •••• •••• ••••';
  }
  // Already plaintext or masked
  return pan;
}

// Helper to decrypt and mask PAN
function decryptAndMaskPan(pan: string | null, encryptionSecret: string): string {
  if (!pan) return '';

  // If not encrypted, return masked
  if (!pan.includes(':')) {
    return maskPan(pan);
  }

  try {
    // For admin view, show last 4 digits
    const parts = pan.split(':');
    if (parts.length === 3) {
      // It's encrypted - show that it's secured
      return '🔒 Encrypted';
    }
  } catch {
    return 'Error';
  }

  return maskPan(pan);
}

interface Checker {
  id: string;
  email: string;
}

function AdminRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [requests, setRequests] = useState<CardRequest[]>([]);
  const [checkers, setCheckers] = useState<Checker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  // Filter states
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [accountNumber, setAccountNumber] = useState(searchParams.get("accountNumber") || "");
  const [customerName, setCustomerName] = useState(searchParams.get("customerName") || "");
  const [customerPhone, setCustomerPhone] = useState(searchParams.get("customerPhone") || "");
  const [customerEmail, setCustomerEmail] = useState(searchParams.get("customerEmail") || "");
  const [checkerId, setCheckerId] = useState(searchParams.get("checkerId") || "all");
  const [pan, setPan] = useState(searchParams.get("pan") || "");
  const [cvv, setCvv] = useState(searchParams.get("cvv") || "");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");

  useEffect(() => {
    fetchCheckers();
    fetchRequests();
  }, [searchParams]);

  async function fetchCheckers() {
    try {
      const res = await fetch("/api/users/checkers");
      const data = await res.json();
      if (data.checkers) {
        setCheckers(data.checkers);
      }
    } catch (error) {
    }
  }

  async function fetchRequests() {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/admin/requests?${params.toString()}`);
      const data = await res.json();
      if (data.requests) {
        setRequests(data.requests);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch requests",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (accountNumber) params.set("accountNumber", accountNumber);
    if (customerName) params.set("customerName", customerName);
    if (customerPhone) params.set("customerPhone", customerPhone);
    if (customerEmail) params.set("customerEmail", customerEmail);
    if (checkerId !== "all") params.set("checkerId", checkerId);
    if (pan) params.set("pan", pan);
    if (cvv) params.set("cvv", cvv);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    router.push(`/admin/requests?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setStatus("all");
    setAccountNumber("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCheckerId("all");
    setPan("");
    setCvv("");
    setStartDate("");
    setEndDate("");
    router.push("/admin/requests");
  };

  const exportToCSV = () => {
    if (requests.length === 0) return;

    const headers = [
      "Date",
      "Account",
      "Name",
      "Phone",
      "Email",
      "Status",
      "Checker",
      "PAN",
      "Expiry",
      // The acceptance record, so an export is evidence of what was agreed.
      "Terms accepted",
      "Terms version",
      "Terms accepted at",
    ];
    const rows = requests.map(req => [
      new Date(req.createdAt).toLocaleDateString(),
      req.accountNumber,
      req.customerName,
      req.customerPhone || "",
      req.customerEmail || "",
      req.status,
      req.checker?.email || "N/A",
      req.pan || "",
      req.expiryDate || "",
      req.termsAccepted ? "Yes" : "No terms in force",
      req.termsVersionNo !== null ? String(req.termsVersionNo) : "",
      req.termsAcceptedAt ? new Date(req.termsAcceptedAt).toLocaleString() : "",
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `card_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pagination = usePagination(requests, 25);

  // Count of filters currently applied via the URL, for the toggle badge.
  const activeFilterCount = Array.from(searchParams.keys()).length;

  return (
    <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="All card requests"
        description="Search, review and export every prepaid card request raised in the system."
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
              onClick={exportToCSV}
              disabled={requests.length === 0}
            >
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

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
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account number</Label>
                <Input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Search account…" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name</Label>
                <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Search name…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone number</Label>
                <Input id="customerPhone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+251…" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input id="customerEmail" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Search email…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checker">Assigned checker</Label>
                <Select value={checkerId} onValueChange={setCheckerId}>
                  <SelectTrigger id="checker">
                    <SelectValue placeholder="All checkers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All checkers</SelectItem>
                    {checkers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={handleClearFilters}>
                <X />
                Clear
              </Button>
              <Button onClick={handleApplyFilters}>
                <Search />
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="animate-fade-in-up overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Customer info</TableHead>
                  <TableHead>Account details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terms accepted</TableHead>
                  <TableHead>Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton columns={6} rows={8} />
              </TableBody>
            </Table>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No card requests found"
              description={
                activeFilterCount > 0
                  ? "No requests match your current filters."
                  : "Card requests raised by makers and customers will appear here."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    <X />
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[8rem]">Date</TableHead>
                      <TableHead>Customer info</TableHead>
                      <TableHead>Account details</TableHead>
                      <TableHead className="w-[8rem]">Status</TableHead>
                      <TableHead className="w-[11rem]">Terms accepted</TableHead>
                      <TableHead>Assignment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((req) => (
                      <TableRow key={req.id} className="align-top">
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className="block text-foreground">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-semibold text-foreground">{req.customerName}</span>
                            <span className="truncate text-xs text-muted-foreground">{req.customerPhone || "No phone"}</span>
                            <span className="truncate text-xs text-muted-foreground">{req.customerEmail || "No email"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm text-foreground">{req.accountNumber}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">ID: {req.id.split('-')[0]}…</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={req.status} withIcon />
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const record = termsRecord(req);
                            return (
                              <div className="flex flex-col gap-1">
                                <Badge variant={record.tone} className="w-fit">
                                  {record.label}
                                </Badge>
                                {record.at && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(record.at).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span>Maker: {req.maker.email.split('@')[0]}</span>
                            <span>Checker: {req.checker?.email.split('@')[0] || "Unassigned"}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-border md:hidden">
                {pagination.pageItems.map((req) => (
                  <div key={req.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {req.customerName}
                        </p>
                        <p className="font-mono text-sm text-muted-foreground">
                          {req.accountNumber}
                        </p>
                      </div>
                      <StatusBadge status={req.status} withIcon />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Phone</dt>
                        <dd className="truncate text-foreground">{req.customerPhone || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Email</dt>
                        <dd className="truncate text-foreground">{req.customerEmail || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Maker</dt>
                        <dd className="truncate text-foreground">{req.maker.email.split('@')[0]}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Checker</dt>
                        <dd className="truncate text-foreground">{req.checker?.email.split('@')[0] || "Unassigned"}</dd>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <dt className="text-muted-foreground">Terms accepted</dt>
                        <dd className="text-foreground">
                          {termsRecord(req).label}
                          {req.termsAcceptedAt
                            ? ` · ${new Date(req.termsAcceptedAt).toLocaleString()}`
                            : ""}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <DataPagination
                pagination={pagination}
                itemLabel="requests"
                pageSizeOptions={[25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function AdminRequestsFallback() {
  return (
    <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </main>
  );
}

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<AdminRequestsFallback />}>
      <AdminRequestsContent />
    </Suspense>
  );
}
