"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, Search } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    email: string;
    role: string;
  } | null;
}

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  async function fetchAuditLogs() {
    try {
      const res = await fetch("/api/audit-logs");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch audit logs",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = filter
    ? logs.filter(
        (log) =>
          log.action.toLowerCase().includes(filter.toLowerCase()) ||
          log.user?.email.toLowerCase().includes(filter.toLowerCase()) ||
          log.entityType.toLowerCase().includes(filter.toLowerCase()),
      )
    : logs;

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
          <h1 className="text-xl font-bold">VPCard Admin - Audit Logs</h1>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            <a
              href="/admin"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Dashboard
            </a>
            <a
              href="/admin/users"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              User Management
            </a>
            <a
              href="/admin/audit"
              className="py-4 px-2 border-b-2 border-primary font-medium text-primary"
            >
              Audit Logs
            </a>
            <a
              href="/admin/requests"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Card Requests
            </a>
            <a
              href="/admin/settings"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Settings
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Audit Logs</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Activity Log</CardTitle>
            <CardDescription>
              Track all user actions and system events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {log.user?.email || "System"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.user?.role}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.action.includes("LOGIN") ||
                          log.action.includes("LOGOUT")
                            ? "bg-primary/20 text-primary"
                            : log.action.includes("CREATE") ||
                                log.action.includes("ASSIGN")
                              ? "bg-green-100 text-green-700"
                              : log.action.includes("APPROVE")
                                ? "bg-purple-100 text-purple-700"
                                : log.action.includes("REJECT")
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>{log.entityType}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {log.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
