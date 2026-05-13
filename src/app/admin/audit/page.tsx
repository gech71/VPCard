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
  actorType: string;
  actorId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
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
          log.actorEmail?.toLowerCase().includes(filter.toLowerCase()) ||
          log.actorId?.toLowerCase().includes(filter.toLowerCase()) ||
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
          <h1 className="text-xl font-bold">Prepaid Card Admin - Audit Logs</h1>
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
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target/Entity</TableHead>
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
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-400 mb-0.5">
                          {log.actorType}
                        </span>
                        <p className="font-medium text-sm">
                          {log.actorEmail || log.user?.email || "System"}
                        </p>
                        {log.actorId && log.actorId !== log.actorEmail && (
                          <p className="text-[10px] text-gray-500 font-mono">
                            ID: {log.actorId}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${
                            log.action.includes("LOGIN") ||
                            log.action.includes("LOGOUT")
                              ? "bg-primary/20 text-primary"
                              : log.action.includes("CREATE") ||
                                  log.action.includes("ASSIGN") ||
                                  log.action.includes("SELF")
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
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">
                          {log.entityType}
                        </span>
                        {log.targetUserId && (
                          <span className="text-[10px] text-primary">
                            Target: {log.targetUserId.slice(0, 8)}...
                          </span>
                        )}
                        {log.entityId && (
                          <span className="text-[10px] text-gray-500">
                            ID: {log.entityId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      <div className="bg-gray-50 p-1.5 rounded border text-[10px] font-mono overflow-auto max-h-20">
                        {JSON.stringify(log.details, null, 2)}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] font-mono">
                      {log.ipAddress}
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
