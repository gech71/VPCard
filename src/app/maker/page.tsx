"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Plus, UserCheck, FileText } from "lucide-react";

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

  useEffect(() => {
    fetchRequests();
    fetchCheckers();
  }, []);

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
    setIsCreateOpen(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Prepaid Card - Maker Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Maker</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Search Customer Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Customer
              </CardTitle>
              <CardDescription>
                Enter account number to retrieve customer information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchCustomer} className="space-y-4">
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accountNumber"
                      type="text"
                      value={searchAccount}
                      onChange={(e) => setSearchAccount(e.target.value)}
                      placeholder="Enter account number"
                      className="flex-1"
                    />
                    <Button type="submit" disabled={searching}>
                      {searching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {customerInfo && (
                <div className="mt-8 p-6 bg-white border border-green-200 shadow-sm rounded-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100 text-green-700 rounded-full flex-shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-lg">
                        Customer Found
                      </h4>
                      <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Validation Successful</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 text-sm mb-8 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    {Object.entries((customerInfo.detail as Record<string, unknown>) || customerInfo)
                      .filter(([key, value]) => value !== null && typeof value !== 'object')
                      .map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="font-medium text-gray-900 break-words">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-6 shadow-md transition-all"
                    onClick={startCreateRequest}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Card Request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Requests Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                My Requests
              </CardTitle>
              <CardDescription>Card requests you have created</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-gray-500 py-8"
                      >
                        No requests yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-sm">
                          {req.accountNumber}
                        </TableCell>
                        <TableCell>{req.customerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                req.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : req.status === "APPROVED"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {req.status}
                            </span>
                            {req.status === "REJECTED" && req.reviewNotes && (
                              <details className="mt-1 w-full max-w-[200px] group cursor-pointer">
                                <summary className="text-[11px] text-red-600 hover:text-red-800 font-medium select-none outline-none">
                                  View Reason
                                </summary>
                                <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-100 mt-1 break-words shadow-sm">
                                  {req.reviewNotes}
                                </div>
                              </details>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {req.checker?.email || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Create Request Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Card Request</DialogTitle>
              <DialogDescription>
                Create a new prepaid card request for the customer
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Customer Information</h4>
                <p className="text-sm">Account: <span className="font-mono bg-white px-2 py-1 rounded border">{searchAccount}</span></p>
                <p className="text-sm mt-2">
                  Name:{" "}
                  <span className="font-semibold text-primary">
                    {((customerInfo?.detail as Record<string, unknown>)?.CustomerName as string) || 
                      ((customerInfo?.detail as Record<string, unknown>)?.customerName as string) ||
                      (customerInfo?.customerName as string) ||
                      (customerInfo?.name as string)}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="makerPhone">Customer Phone *</Label>
                  <Input
                    id="makerPhone"
                    value={makerPhone}
                    onChange={(e) => setMakerPhone(e.target.value)}
                    placeholder="+2519XXXXXXXX"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground italic">Format: +251933704978</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="makerEmail">Customer Email *</Label>
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

              <div>
                <Label htmlFor="checker">Assign to Checker</Label>
                <Select
                  value={selectedChecker}
                  onValueChange={setSelectedChecker}
                >
                  <SelectTrigger>
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

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <textarea
                  id="notes"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  rows={3}
                  placeholder="Add any additional notes..."
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !selectedChecker}
              >
                {submitting ? "Creating..." : "Create Request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
