"use client";

import { useState, useEffect } from "react";
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
import { Loader2, Search, Filter, Download, X, Lock } from "lucide-react";

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

export default function AdminRequestsPage() {
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

    const headers = ["Date", "Account", "Name", "Phone", "Email", "Status", "Checker", "PAN", "CVV", "Expiry"];
    const rows = requests.map(req => [
      new Date(req.createdAt).toLocaleDateString(),
      req.accountNumber,
      req.customerName,
      req.customerPhone || "",
      req.customerEmail || "",
      req.status,
      req.checker?.email || "N/A",
      req.pan || "",
      req.expiryDate || ""
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Prepaid Card Admin - Card Requests</h1>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition">
              Logout
            </button>
          </form>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            <a href="/admin" className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition">Dashboard</a>
            <a href="/admin/users" className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition">User Management</a>
            <a href="/admin/requests" className="py-4 px-2 border-b-2 border-primary font-medium text-primary">Card Requests</a>
            <a href="/admin/audit" className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition">Audit Logs</a>
            <a href="/admin/customer-mapping" className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition">Customer Mapping</a>
            <a href="/admin/settings" className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition">Settings</a>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">All Card Requests</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {showFilters && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Advanced Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Search account..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Search name..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone Number</Label>
                  <Input id="customerPhone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+251..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input id="customerEmail" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Search email..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checker">Assigned Checker</Label>
                  <Select value={checkerId} onValueChange={setCheckerId}>
                    <SelectTrigger id="checker">
                      <SelectValue placeholder="All Checkers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Checkers</SelectItem>
                      {checkers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={handleClearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button onClick={handleApplyFilters}>
                  <Search className="w-4 h-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Customer Info</TableHead>
                    <TableHead>Account Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-gray-500">Loading requests...</p>
                      </TableCell>
                    </TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                        No card requests found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="text-sm">
                          {new Date(req.createdAt).toLocaleDateString()}
                          <br />
                          <span className="text-[10px] text-gray-400">
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{req.customerName}</span>
                            <span className="text-xs text-gray-500">{req.customerPhone || "No Phone"}</span>
                            <span className="text-xs text-gray-500">{req.customerEmail || "No Email"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm">{req.accountNumber}</span>
                            <span className="text-[10px] text-gray-400">ID: {req.id.split('-')[0]}...</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
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
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="text-gray-500">Maker: {req.maker.email.split('@')[0]}</span>
                            <span className="text-gray-500">Checker: {req.checker?.email.split('@')[0] || "Unassigned"}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
