"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, CheckCircle, XCircle, Eye } from "lucide-react";

interface CardRequest {
  id: string;
  customerId: string | null;
  accountNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  maker: {
    email: string;
  };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Prepaid Card - Checker Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Checker</span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <FileText className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Review</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {pendingRequests.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {
                      reviewedRequests.filter((r) => r.status === "APPROVED")
                        .length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {
                      reviewedRequests.filter((r) => r.status === "REJECTED")
                        .length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="reviewed">
              Reviewed ({reviewedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Requests Pending Review</CardTitle>
                <CardDescription>
                  Review and approve or reject card requests assigned to you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-8"
                        >
                          No pending requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm">
                            {req.accountNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.customerName}</p>
                              {req.customerEmail && (
                                <p className="text-xs text-gray-500">
                                  {req.customerEmail}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {req.maker.email}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReviewDialog(req, "APPROVE")}
                              >
                                <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReviewDialog(req, "REJECT")}
                              >
                                <XCircle className="w-4 h-4 mr-1 text-red-600" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviewed">
            <Card>
              <CardHeader>
                <CardTitle>Reviewed Requests</CardTitle>
                <CardDescription>
                  History of requests you have reviewed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reviewed At</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewedRequests.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-8"
                        >
                          No reviewed requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      reviewedRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm">
                            {req.accountNumber}
                          </TableCell>
                          <TableCell>{req.customerName}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                req.status === "APPROVED"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {req.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {req.reviewedAt
                              ? new Date(req.reviewedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                            {req.reviewNotes || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReviewDialog(req, "VIEW")}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reviewAction === "VIEW"
                  ? "Request Details"
                  : reviewAction === "APPROVE"
                    ? "Approve Request"
                    : "Reject Request"}
              </DialogTitle>
              <DialogDescription>
                {reviewAction === "VIEW"
                  ? "Full information for the selected card request."
                  : reviewAction === "APPROVE"
                    ? "This will approve the card request and send it to the PSS system."
                    : "This will reject the card request. The maker will be notified."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleReview} className="space-y-4">
              {selectedRequest && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-semibold text-primary border-b pb-2 mb-2 flex justify-between items-center">
                    <span>Request Details</span>
                    {reviewAction === "VIEW" && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${
                          selectedRequest.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {selectedRequest.status}
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Customer Name</p>
                      <p className="font-mono">
                        {selectedRequest.customerName}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">
                        Account Number
                      </p>
                      <p className="font-mono">
                        {selectedRequest.accountNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Customer ID</p>
                      <p className="font-mono">
                        {selectedRequest.customerId || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Phone Number</p>
                      <p className="font-mono">
                        {selectedRequest.customerPhone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Email Address</p>
                      <p
                        className="font-mono text-[11px] truncate"
                        title={selectedRequest.customerEmail || ""}
                      >
                        {selectedRequest.customerEmail || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Created At</p>
                      <p className="font-mono">
                        {new Date(
                          selectedRequest.createdAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500 font-medium">Requested By</p>
                      <p className="font-mono">{selectedRequest.maker.email}</p>
                    </div>
                  </div>
                  {selectedRequest.notes && (
                    <div className="mt-3 pt-2 border-t text-sm">
                      <p className="text-gray-500 font-medium mb-1">
                        Maker's Notes
                      </p>
                      <p className="bg-white p-2 rounded border italic">
                        {selectedRequest.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="reviewNotes">
                  {reviewAction === "VIEW"
                    ? "Reviewer Notes"
                    : "Review Notes (Optional)"}
                </Label>
                <textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={reviewAction === "VIEW"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  rows={3}
                  placeholder={
                    reviewAction === "VIEW" ? "" : "Add your review notes..."
                  }
                />
              </div>

              <div className="flex gap-2">
                {reviewAction !== "VIEW" ? (
                  <>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={submitting}
                    >
                      {submitting
                        ? "Processing..."
                        : reviewAction === "APPROVE"
                          ? "Approve"
                          : "Reject"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsReviewOpen(false)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    className="w-full"
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
    </div>
  );
}
