"use client";

import { useMemo, useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import {
  CheckCircle,
  Eye,
  FileText,
  Inbox,
  Loader2,
  Search,
  SearchX,
  XCircle,
} from "lucide-react";

interface CardRequest {
  id: string;
  customerId: string | null;
  accountNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  cardProgramCode: string | null;
  cardProgramName: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  maker: {
    email: string;
  };
}

/** Label/value pair inside the review dialog summary. */
function DetailItem({
  label,
  value,
  className = "",
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`truncate text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function CheckerDashboard() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CardRequest | null>(
    null,
  );
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<
    "APPROVE" | "REJECT" | "VIEW" | null
  >(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Presentation-only filters over the rows already loaded.
  const [pendingFilter, setPendingFilter] = useState("");
  const [reviewedFilter, setReviewedFilter] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const res = await fetch("/api/card-requests?type=assigned");
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

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || !reviewAction) return;

    setSubmitting(true);

    try {
      const res = await fetch(`/api/card-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          reviewNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to review request",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Request ${reviewAction.toLowerCase()}d successfully`,
      });

      setIsReviewOpen(false);
      setSelectedRequest(null);
      setReviewAction(null);
      setReviewNotes("");
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

  function openReviewDialog(
    request: CardRequest,
    action: "APPROVE" | "REJECT" | "VIEW",
  ) {
    setSelectedRequest(request);
    setReviewAction(action);
    if (action === "VIEW") {
      setReviewNotes(request.reviewNotes || "");
    } else {
      setReviewNotes("");
    }
    setIsReviewOpen(true);
  }

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const reviewedRequests = requests.filter((r) => r.status !== "PENDING");

  const filteredPending = useMemo(() => {
    const term = pendingFilter.trim().toLowerCase();
    if (!term) return pendingRequests;
    return pendingRequests.filter(
      (r) =>
        r.accountNumber.toLowerCase().includes(term) ||
        r.customerName.toLowerCase().includes(term) ||
        r.customerEmail?.toLowerCase().includes(term) ||
        r.maker.email.toLowerCase().includes(term),
    );
  }, [pendingRequests, pendingFilter]);

  const filteredReviewed = useMemo(() => {
    const term = reviewedFilter.trim().toLowerCase();
    if (!term) return reviewedRequests;
    return reviewedRequests.filter(
      (r) =>
        r.accountNumber.toLowerCase().includes(term) ||
        r.customerName.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term) ||
        r.reviewNotes?.toLowerCase().includes(term),
    );
  }, [reviewedRequests, reviewedFilter]);

  const pendingPagination = usePagination(filteredPending, 10);
  const reviewedPagination = usePagination(filteredReviewed, 10);

  const approvedCount = reviewedRequests.filter(
    (r) => r.status === "APPROVED",
  ).length;
  const rejectedCount = reviewedRequests.filter(
    (r) => r.status === "REJECTED",
  ).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Card requests"
        description="Review the prepaid card requests assigned to you and approve or reject them. E-commerce activation is handled separately."
      />

        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Pending review"
            value={pendingRequests.length}
            icon={FileText}
            tone="warning"
            hint="Awaiting your decision"
            isLoading={loading}
          />
          <StatCard
            label="Approved"
            value={approvedCount}
            icon={CheckCircle}
            tone="success"
            hint="Sent to PSS"
            isLoading={loading}
          />
          <StatCard
            label="Rejected"
            value={rejectedCount}
            icon={XCircle}
            tone="danger"
            hint="Returned to maker"
            isLoading={loading}
          />
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <span className="rounded-full bg-warning-muted px-1.5 text-xs font-semibold tabular-nums text-warning-muted-foreground">
                {pendingRequests.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="reviewed">
              Reviewed
              <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs font-semibold tabular-nums">
                {reviewedRequests.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card className="overflow-hidden">
              <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="space-y-0.5">
                  <CardTitle>Requests pending review</CardTitle>
                  <CardDescription>
                    Review and approve or reject card requests assigned to you
                  </CardDescription>
                </div>
                {pendingRequests.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={pendingFilter}
                      onChange={(e) => setPendingFilter(e.target.value)}
                      placeholder="Filter pending"
                      aria-label="Filter pending requests"
                      className="h-9 pl-9"
                    />
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Account</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Created by</TableHead>
                        <TableHead>Created at</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableSkeleton columns={5} />
                    </TableBody>
                  </Table>
                ) : pendingRequests.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No pending requests"
                    description="You are all caught up. New requests assigned to you will appear here."
                  />
                ) : filteredPending.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No matching requests"
                    description="Try a different account number, customer or maker."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingFilter("")}
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
                          <TableHead>Created by</TableHead>
                          <TableHead>Created at</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPagination.pageItems.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="whitespace-nowrap font-mono text-sm">
                              {req.accountNumber}
                            </TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {req.customerName}
                                </p>
                                {req.customerEmail && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {req.customerEmail}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {req.maker.email}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-success hover:border-success/40 hover:bg-success-muted hover:text-success"
                                  onClick={() =>
                                    openReviewDialog(req, "APPROVE")
                                  }
                                >
                                  <CheckCircle />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:border-destructive/40 hover:bg-destructive-muted hover:text-destructive"
                                  onClick={() => openReviewDialog(req, "REJECT")}
                                >
                                  <XCircle />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <DataPagination
                      pagination={pendingPagination}
                      itemLabel="pending requests"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviewed">
            <Card className="overflow-hidden">
              <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="space-y-0.5">
                  <CardTitle>Reviewed requests</CardTitle>
                  <CardDescription>
                    History of requests you have reviewed
                  </CardDescription>
                </div>
                {reviewedRequests.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={reviewedFilter}
                      onChange={(e) => setReviewedFilter(e.target.value)}
                      placeholder="Filter reviewed"
                      aria-label="Filter reviewed requests"
                      className="h-9 pl-9"
                    />
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Account</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed at</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableSkeleton columns={6} />
                    </TableBody>
                  </Table>
                ) : reviewedRequests.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No reviewed requests"
                    description="Requests you approve or reject will be listed here."
                  />
                ) : filteredReviewed.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No matching requests"
                    description="Try a different account number, customer or status."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewedFilter("")}
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
                          <TableHead>Reviewed at</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviewedPagination.pageItems.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="whitespace-nowrap font-mono text-sm">
                              {req.accountNumber}
                            </TableCell>
                            <TableCell className="font-medium">
                              {req.customerName}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={req.status} withIcon />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {req.reviewedAt
                                ? new Date(req.reviewedAt).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                              {req.reviewNotes || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openReviewDialog(req, "VIEW")}
                                >
                                  <Eye />
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <DataPagination
                      pagination={reviewedPagination}
                      itemLabel="reviewed requests"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {reviewAction === "VIEW"
                  ? "Request details"
                  : reviewAction === "APPROVE"
                    ? "Approve request"
                    : "Reject request"}
              </DialogTitle>
              <DialogDescription>
                {reviewAction === "VIEW"
                  ? "Full information for the selected card request."
                  : reviewAction === "APPROVE"
                    ? "This will approve the card request and send it to the PSS system."
                    : "This will reject the card request. The maker will be notified."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReview} className="space-y-5">
              {selectedRequest && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      Request details
                    </h4>
                    {reviewAction === "VIEW" && (
                      <StatusBadge status={selectedRequest.status} withIcon />
                    )}
                  </div>

                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailItem
                      label="Card program"
                      value={
                        selectedRequest.cardProgramName ||
                        selectedRequest.cardProgramCode ||
                        "N/A"
                      }
                      mono={false}
                    />
                    <DetailItem
                      label="Customer name"
                      value={selectedRequest.customerName}
                      mono={false}
                    />
                    <DetailItem
                      label="Account number"
                      value={selectedRequest.accountNumber}
                    />
                    <DetailItem
                      label="Customer ID"
                      value={selectedRequest.customerId || "N/A"}
                    />
                    <DetailItem
                      label="Phone number"
                      value={selectedRequest.customerPhone || "N/A"}
                    />
                    <DetailItem
                      label="Email address"
                      value={
                        <span title={selectedRequest.customerEmail || ""}>
                          {selectedRequest.customerEmail || "N/A"}
                        </span>
                      }
                    />
                    <DetailItem
                      label="Created at"
                      value={new Date(
                        selectedRequest.createdAt,
                      ).toLocaleDateString()}
                    />
                    <DetailItem
                      label="Requested by"
                      value={selectedRequest.maker.email}
                    />
                  </dl>

                  {selectedRequest.notes && (
                    <div className="border-t border-border pt-3">
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        Maker&rsquo;s notes
                      </p>
                      <p className="rounded-md border border-border bg-card p-2.5 text-sm italic text-foreground">
                        {selectedRequest.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reviewNotes">
                  {reviewAction === "VIEW"
                    ? "Reviewer notes"
                    : "Review notes (optional)"}
                </Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={reviewAction === "VIEW"}
                  rows={3}
                  placeholder={
                    reviewAction === "VIEW" ? "" : "Add your review notes…"
                  }
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {reviewAction !== "VIEW" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsReviewOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant={
                        reviewAction === "REJECT" ? "destructive" : "success"
                      }
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Processing&hellip;
                        </>
                      ) : reviewAction === "APPROVE" ? (
                        <>
                          <CheckCircle />
                          Approve
                        </>
                      ) : (
                        <>
                          <XCircle />
                          Reject
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => setIsReviewOpen(false)}
                  >
                    Close
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
    </main>
  );
}
