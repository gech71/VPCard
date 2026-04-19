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
    const customerName = (customerInfo.customerName ||
      customerInfo.name ||
      customerInfo.custName ||
      "Unknown") as string;
    const customerEmail = customerInfo.email as string | undefined;
    const customerPhone =
      customerInfo.phoneNumber ||
      customerInfo.phone ||
      (customerInfo.mobile as string | undefined);

    try {
      const res = await fetch("/api/card-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber,
          customerName,
          customerEmail,
          customerPhone,
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
          <h1 className="text-xl font-bold">VPCard - Maker Dashboard</h1>
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
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">
                    Customer Found
                  </h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(customerInfo).map(([key, value]) => (
                      <p key={key}>
                        <span className="font-medium">{key}:</span>{" "}
                        {String(value)}
                      </p>
                    ))}
                  </div>
                  <Button
                    className="mt-4 bg-green-600 hover:bg-green-700"
                    onClick={startCreateRequest}
                  >
                    <Plus className="w-4 h-4 mr-2" />
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
                <p className="text-sm">Account: {searchAccount}</p>
                <p className="text-sm">
                  Name:{" "}
                  {customerInfo?.customerName ||
                    customerInfo?.name ||
                    customerInfo?.custName}
                </p>
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
