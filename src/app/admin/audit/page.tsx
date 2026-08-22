"use client";

import { useMemo, useState, useEffect } from "react";
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
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import { ScrollText, Search, SearchX } from "lucide-react";

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

/** Colour-codes an action name so scanning the log is faster. */
function actionTone(action: string): NonNullable<BadgeProps["variant"]> {
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "brand";
  if (
    action.includes("CREATE") ||
    action.includes("ASSIGN") ||
    action.includes("SELF")
  )
    return "success";
  if (action.includes("APPROVE")) return "info";
  if (action.includes("REJECT") || action.includes("DELETE")) return "danger";
  return "neutral";
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

  const filteredLogs = useMemo(
    () =>
      filter
        ? logs.filter(
            (log) =>
              log.action.toLowerCase().includes(filter.toLowerCase()) ||
              log.user?.email.toLowerCase().includes(filter.toLowerCase()) ||
              log.actorEmail?.toLowerCase().includes(filter.toLowerCase()) ||
              log.actorId?.toLowerCase().includes(filter.toLowerCase()) ||
              log.entityType.toLowerCase().includes(filter.toLowerCase()),
          )
        : logs,
    [logs, filter],
  );

  const pagination = usePagination(filteredLogs, 25);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Audit logs"
        description="Track user actions and system events across the platform."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search action, actor or entity"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Search audit logs"
              className="pl-9"
            />
          </div>
        }
      />

      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader>
          <CardTitle>System activity log</CardTitle>
          <CardDescription>
            {loading
              ? "Loading recorded events…"
              : `${filteredLogs.length} event${filteredLogs.length === 1 ? "" : "s"}${
                  filter ? ` matching “${filter}”` : ""
                }.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target / entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton columns={6} rows={8} />
              </TableBody>
            </Table>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit events"
              description="Actions performed in the system will be recorded here."
            />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching events"
              description={`Nothing matches “${filter}”. Try a different search term.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <>
              <Table containerClassName="max-h-[36rem] overflow-y-auto" className="table-sticky-head">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[11rem]">Timestamp</TableHead>
                    <TableHead className="min-w-[13rem]">Actor</TableHead>
                    <TableHead className="min-w-[10rem]">Action</TableHead>
                    <TableHead className="min-w-[10rem]">
                      Target / entity
                    </TableHead>
                    <TableHead className="min-w-[14rem]">Details</TableHead>
                    <TableHead className="min-w-[8rem]">IP address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((log) => (
                    <TableRow key={log.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>

                      <TableCell>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {log.actorType}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">
                            {log.actorEmail || log.user?.email || "System"}
                          </span>
                          {log.actorId && log.actorId !== log.actorEmail && (
                            <span className="truncate font-mono text-[10px] text-muted-foreground">
                              ID: {log.actorId}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={actionTone(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {log.entityType}
                          </span>
                          {log.targetUserId && (
                            <span className="font-mono text-[10px] text-primary-muted-foreground">
                              Target: {log.targetUserId.slice(0, 8)}…
                            </span>
                          )}
                          {log.entityId && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ID: {log.entityId.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {log.details ? (
                          <pre className="max-h-24 max-w-[18rem] overflow-auto rounded-md border border-border bg-muted/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {log.ipAddress || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataPagination
                pagination={pagination}
                itemLabel="events"
                pageSizeOptions={[25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
