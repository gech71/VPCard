"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import AppHeader from "@/components/app-header";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import StatusBadge from "@/components/status-badge";
import DataPagination from "@/components/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import {
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  Search,
  SearchX,
  UserCheck,
} from "lucide-react";

interface Checker {
  id: string;
  email: string;
  createdAt: string;
}

interface CardRequest {
  id: string;
  accountNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  checker: {
    email: string;
  } | null;
}

interface CustomerInfo {
  // This will vary based on the actual API response
  [key: string]: unknown;
}

interface ProgramOption {
  code: string;
  name: string;
  bin: string;
}

export default function MakerDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<CardRequest[]>([]);
  const [checkers, setCheckers] = useState<Checker[]>([]);

  // Search customer state
  const [searchAccount, setSearchAccount] = useState("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [searching, setSearching] = useState(false);

  // Create request state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedChecker, setSelectedChecker] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [makerPhone, setMakerPhone] = useState("");
  const [makerEmail, setMakerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cardPrograms, setCardPrograms] = useState<ProgramOption[]>([]);
  const [selectedCardProgram, setSelectedCardProgram] = useState("");

  // Presentation-only filtering of the requests already loaded.
  const [requestFilter, setRequestFilter] = useState("");

  useEffect(() => {
    fetchRequests();
    fetchCheckers();
    fetchCardPrograms();
  }, []);

  async function fetchCardPrograms() {
    try {
      const res = await fetch("/api/card-programs?audience=maker");
      const data = await res.json();
      if (res.ok && data.programs) {
        setCardPrograms(data.programs);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load card programs",
      });
    }
  }

  async function fetchRequests() {
    try {
      const res = await fetch("/api/card-requests?type=created");
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
    }
  }

  async function fetchCheckers() {
    try {
      const res = await fetch("/api/users/checkers");
      const data = await res.json();
      if (data.checkers) {
        setCheckers(data.checkers);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch checkers",
      });
    }
  }

  async function handleSearchCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!searchAccount.trim()) return;

    // Account Number Validation: must start with 7000 and be exactly 13 digits
    const accountRegex = /^7000\d{9}$/;
    if (!accountRegex.test(searchAccount)) {
      toast({
        variant: "destructive",
        title: "Invalid Account Number",
        description: "Account number must start with 7000 and be exactly 13 digits.",
      });
      return;
    }

    setSearching(true);
    setCustomerInfo(null);

    try {
      const res = await fetch("/api/customer/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: searchAccount }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Search Failed",
          description: data.error || "Failed to search customer",
        });
        return;
      }

      if (data.customer) {
        setCustomerInfo(data.customer);
        // Pre-fill phone and email if available
        const detail = (data.customer.detail as Record<string, unknown>) || data.customer;
        const phone = (detail.PhoneNumber || detail.phoneNumber || detail.phone || detail.mobile || "") as string;
        const email = (detail.Email || detail.email || "") as string;
        setMakerPhone(phone);
        setMakerEmail(email);
      } else {
        toast({
          title: "Not Found",
          description: "No customer found with this account number",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!customerInfo || !selectedChecker) return;

    if (!selectedCardProgram) {
      toast({
        variant: "destructive",
        title: "Card product required",
        description: "Please select a card program.",
      });
      return;
    }

    setSubmitting(true);

    // Extract customer details from the API response
    const accountNumber = searchAccount;
    const detail = (customerInfo.detail as Record<string, unknown>) || customerInfo;
    const extractedCustomerId = detail.CustomerId || detail.customerId || detail.customerID;
    const customerId = extractedCustomerId ? String(extractedCustomerId) : undefined;
    const customerName = (detail.CustomerName ||
      detail.customerName ||
      detail.name ||
      detail.custName ||
      "Unknown") as string;
    const customerEmail = (detail.Email || detail.email) as string | undefined;
    const customerPhone =
      (detail.PhoneNumber ||
      detail.phoneNumber ||
      detail.phone ||
      detail.mobile) as string | undefined;

    // Normalization and Validation
    let normalizedPhone = makerPhone.trim();
    if (normalizedPhone.startsWith("251")) {
      normalizedPhone = `+${normalizedPhone}`;
    } else if (normalizedPhone.startsWith("0")) {
      normalizedPhone = `+251${normalizedPhone.slice(1)}`;
    }

    const phoneRegex = /^\+251(9|7)\d{8}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: "Phone number must be in the format +251XXXXXXXXX (starting with 9 or 7)",
      });
      setSubmitting(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(makerEmail)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/card-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          accountNumber,
          customerName,
          customerEmail: makerEmail,
          customerPhone: normalizedPhone,
          checkerId: selectedChecker,
          cardProgramCode: selectedCardProgram,
          notes: requestNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create request",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Card request created successfully",
      });

      setIsCreateOpen(false);
      setCustomerInfo(null);
      setSearchAccount("");
      setSelectedChecker("");
      setRequestNotes("");
      setMakerPhone("");
      setMakerEmail("");
      setSelectedCardProgram("");
      fetchRequests();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function startCreateRequest() {
    if (!customerInfo) return;
    setSelectedCardProgram("");
    setIsCreateOpen(true);
  }

  const customerName =
    ((customerInfo?.detail as Record<string, unknown>)?.CustomerName as string) ||
    ((customerInfo?.detail as Record<string, unknown>)?.customerName as string) ||
    (customerInfo?.customerName as string) ||
    (customerInfo?.name as string);

  const filteredRequests = useMemo(() => {
    const term = requestFilter.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter(
      (req) =>
        req.accountNumber.toLowerCase().includes(term) ||
        req.customerName.toLowerCase().includes(term) ||
        req.status.toLowerCase().includes(term) ||
        req.checker?.email.toLowerCase().includes(term),
    );
  }, [requests, requestFilter]);

  const pagination = usePagination(filteredRequests, 10);

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader
        title="NIB Prepaid Card"
        subtitle="Maker dashboard"
        role="Maker"
        showLogout
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader
          title="Maker dashboard"
          description="Look up a customer by account number, then raise a prepaid card request for a checker to review."
        />

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          {/* Search Customer Section */}
          <Card className="animate-fade-in-up">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
                  <Search className="h-4 w-4" />
                </span>
                <div className="space-y-0.5">
                  <CardTitle>Search customer</CardTitle>
                  <CardDescription>
                    Enter an account number to retrieve customer information
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSearchCustomer} className="space-y-2">
                <Label htmlFor="accountNumber">Account number</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="accountNumber"
                    type="text"
                    inputMode="numeric"
                    value={searchAccount}
                    onChange={(e) => setSearchAccount(e.target.value)}
                    placeholder="7000XXXXXXXXX"
                    className="flex-1 font-mono"
                  />
                  <Button
                    type="submit"
                    disabled={searching}
                    className="sm:w-32"
                  >
                    {searching ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Searching
                      </>
                    ) : (
                      <>
                        <Search />
                        Search
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must start with 7000 and be exactly 13 digits.
                </p>
              </form>

              {customerInfo && (
                <div className="animate-fade-in-up space-y-5 rounded-lg border border-success/25 bg-success-muted/40 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 animate-check-pop items-center justify-center rounded-full bg-success-muted text-success">
                      <UserCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold text-foreground">
                        {customerName || "Customer found"}
                      </h4>
                      <p className="text-xs font-medium uppercase tracking-wider text-success">
                        Validation successful
                      </p>
                    </div>
                  </div>

                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                      Customer details
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                        {Object.entries(
                          (customerInfo.detail as Record<string, unknown>) ||
                            customerInfo,
                        )
                          .filter(
                            ([key, value]) =>
                              value !== null && typeof value !== "object",
                          )
                          .map(([key, value]) => (
                            <div key={key} className="min-w-0">
                              <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </dt>
                              <dd className="break-words text-sm font-medium text-foreground">
                                {String(value)}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </CollapsibleContent>
                  </Collapsible>

                  <Button
                    variant="success"
                    size="lg"
                    className="w-full"
                    onClick={startCreateRequest}
                  >
                    <Plus />
                    Create card request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Requests Section */}
          <Card className="animate-fade-in-up overflow-hidden">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="space-y-0.5">
                  <CardTitle>My requests</CardTitle>
                  <CardDescription>
                    Card requests you have created
                  </CardDescription>
                </div>
              </div>

              {requests.length > 0 && (
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={requestFilter}
                    onChange={(e) => setRequestFilter(e.target.value)}
                    placeholder="Filter requests"
                    aria-label="Filter requests"
                    className="h-9 pl-9"
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {requests.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No requests yet"
                  description="Search for a customer above to create your first card request."
                />
              ) : filteredRequests.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No matching requests"
                  description="Try a different account number, customer or status."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestFilter("")}
                    >
                      Clear filter
                    </Button>
                  }
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Account</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned to</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagination.pageItems.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="whitespace-nowrap font-mono text-sm">
                            {req.accountNumber}
                          </TableCell>
                          <TableCell className="font-medium">
                            {req.customerName}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1.5">
                              <StatusBadge status={req.status} withIcon />
                              {req.status === "REJECTED" && req.reviewNotes && (
                                <details className="group w-full max-w-[15rem]">
                                  <summary className="cursor-pointer select-none text-xs font-medium text-destructive outline-none transition-colors hover:text-destructive/80">
                                    View reason
                                  </summary>
                                  <p className="mt-1.5 break-words rounded-md border border-destructive/20 bg-destructive-muted p-2 text-xs text-destructive-muted-foreground">
                                    {req.reviewNotes}
                                  </p>
                                </details>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {req.checker?.email || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <DataPagination
                    pagination={pagination}
                    itemLabel="requests"
                    pageSizeOptions={[10, 25, 50]}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Request Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create card request</DialogTitle>
              <DialogDescription>
                Create a new prepaid card request for the customer.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateRequest} className="space-y-5">
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
                <h4 className="text-sm font-semibold text-foreground">
                  Customer information
                </h4>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Account</dt>
                    <dd className="font-mono text-sm font-medium text-foreground">
                      {searchAccount}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Name</dt>
                    <dd className="truncate text-sm font-semibold text-foreground">
                      {customerName}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardProduct">
                  Card product <span className="text-destructive">*</span>
                </Label>
                {cardPrograms.length === 0 ? (
                  <p className="rounded-md border border-warning/25 bg-warning-muted px-3 py-2.5 text-sm text-warning-muted-foreground">
                    No card programs are enabled for maker requests. Ask a Super
                    Admin to enable products under Settings.
                  </p>
                ) : (
                  <Select
                    value={selectedCardProgram}
                    onValueChange={setSelectedCardProgram}
                  >
                    <SelectTrigger id="cardProduct">
                      <SelectValue placeholder="Select card type" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardPrograms.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name} ({p.code}) — BIN {p.bin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="makerPhone">
                    Customer phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="makerPhone"
                    value={makerPhone}
                    onChange={(e) => setMakerPhone(e.target.value)}
                    placeholder="+2519XXXXXXXX"
                    className="font-mono"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: +251933704978
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="makerEmail">
                    Customer email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="makerEmail"
                    type="email"
                    value={makerEmail}
                    onChange={(e) => setMakerEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="checker">Assign to checker</Label>
                <Select
                  value={selectedChecker}
                  onValueChange={setSelectedChecker}
                >
                  <SelectTrigger id="checker">
                    <SelectValue placeholder="Select a checker" />
                  </SelectTrigger>
                  <SelectContent>
                    {checkers.map((checker) => (
                      <SelectItem key={checker.id} value={checker.id}>
                        {checker.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any additional notes…"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedChecker ||
                    !selectedCardProgram ||
                    cardPrograms.length === 0
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating&hellip;
                    </>
                  ) : (
                    "Create request"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
