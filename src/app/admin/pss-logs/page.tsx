"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  SearchX,
  ServerCog,
  Timer,
  X,
  XCircle,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import EmptyState from "@/components/empty-state";
import PssLogDetailDialog from "@/components/pss-log-detail-dialog";
import { cn } from "@/lib/utils";
import type {
  PssApiLogListResponse,
  PssApiLogRow,
  PssApiLogSummary,
} from "@/lib/pss-log-types";

const PAGE_SIZE = 25;

type SortField = "createdAt" | "durationMs" | "statusCode" | "serviceName";

const EMPTY_SUMMARY: PssApiLogSummary = {
  total: 0,
  successes: 0,
  failures: 0,
  avgDurationMs: 0,
};

/** Slow calls are the ones worth noticing before they become failures. */
function durationTone(ms: number) {
  if (ms >= 5000) return "text-destructive";
  if (ms >= 2000) return "text-warning-muted-foreground";
  return "text-muted-foreground";
}

function StatusCell({ log }: { log: PssApiLogRow }) {
  return (
    <div className="flex items-center gap-2">
      {log.success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      )}
      <span className="font-mono text-xs">
        {log.statusCode ?? <span className="text-destructive">no response</span>}
      </span>
    </div>
  );
}

export default function PssLogsPage() {
  const [logs, setLogs] = useState<PssApiLogRow[]>([]);
  const [summary, setSummary] = useState<PssApiLogSummary>(EMPTY_SUMMARY);
  const [services, setServices] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [service, setService] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sort + paging
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Typing in the search box should not fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, service, outcome, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      sortBy,
      sortDir,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (service !== "all") params.set("service", service);
    if (outcome !== "all") params.set("outcome", outcome);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    try {
      const res = await fetch(`/api/admin/pss-logs?${params.toString()}`);
      const data = (await res.json()) as PssApiLogListResponse & { error?: string };

      if (!res.ok) {
        setError(data.error || "Could not load API logs.");
        setLogs([]);
        return;
      }

      setLogs(data.logs);
      setTotal(data.total);
      setSummary(data.summary);
      setServices(data.services);
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, service, outcome, startDate, endDate, sortBy, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters =
    !!search || service !== "all" || outcome !== "all" || !!startDate || !!endDate;

  function clearFilters() {
    setSearch("");
    setService("all");
    setOutcome("all");
    setStartDate("");
    setEndDate("");
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(0);
  }

  function SortButton({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) {
    const active = sortBy === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn(
          "group inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground",
          active ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Sort by ${field}`}
      >
        {children}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </button>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const failureRate = useMemo(() => {
    if (summary.total === 0) return "0%";
    return `${Math.round((summary.failures / summary.total) * 100)}%`;
  }, [summary]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="PSS API Audit"
        description="Every request sent to and response received from the PSS integration. Credentials, tokens, PINs and card numbers are removed before each record is stored."
        actions={
          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total calls"
          value={summary.total.toLocaleString()}
          icon={ServerCog}
          isLoading={loading}
          hint={hasFilters ? "Matching current filters" : "All recorded calls"}
        />
        <StatCard
          label="Successful"
          value={summary.successes.toLocaleString()}
          icon={CheckCircle2}
          tone="success"
          isLoading={loading}
          hint="HTTP 2xx responses"
        />
        <StatCard
          label="Failed"
          value={summary.failures.toLocaleString()}
          icon={AlertTriangle}
          tone="danger"
          isLoading={loading}
          hint={`${failureRate} of matching calls`}
        />
        <StatCard
          label="Average response"
          value={`${summary.avgDurationMs.toLocaleString()} ms`}
          icon={Timer}
          isLoading={loading}
          hint="Across matching calls"
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filters
          </CardTitle>
          <CardDescription>
            Narrow by service, outcome or period, or search an endpoint,
            correlation ID or error message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="pss-search">Search</Label>
              <Input
                id="pss-search"
                placeholder="Endpoint, correlation ID or error…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pss-service">Service</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="pss-service">
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {services.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pss-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="pss-outcome">
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  <SelectItem value="success">Successful only</SelectItem>
                  <SelectItem value="failure">Failed only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="pss-from">From</Label>
                <Input
                  id="pss-from"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pss-to">To</Label>
                <Input
                  id="pss-to"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API calls</CardTitle>
          <CardDescription>
            Select a row to see the full redacted request and response.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">
                    <SortButton field="createdAt">Timestamp</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="serviceName">Service</SortButton>
                  </TableHead>
                  <TableHead className="w-[90px]">Method</TableHead>
                  <TableHead className="w-[130px]">
                    <SortButton field="statusCode">Status</SortButton>
                  </TableHead>
                  <TableHead className="w-[110px] text-right">
                    <SortButton field="durationMs">Duration</SortButton>
                  </TableHead>
                  <TableHead className="min-w-[220px]">Endpoint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!loading && error && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={AlertTriangle}
                        title="Could not load API logs"
                        description={error}
                        action={
                          <Button variant="outline" size="sm" onClick={load}>
                            Try again
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}

                {!loading && !error && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={hasFilters ? SearchX : ServerCog}
                        title={
                          hasFilters
                            ? "No calls match these filters"
                            : "No PSS API calls recorded yet"
                        }
                        description={
                          hasFilters
                            ? "Try widening the date range or clearing the search."
                            : "Calls appear here as soon as the application contacts PSS."
                        }
                        action={
                          hasFilters ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                            >
                              Clear filters
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}

                {!loading &&
                  !error &&
                  logs.map((log) => (
                    <TableRow
                      key={log.id}
                      onClick={() => setSelectedId(log.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open details for ${log.serviceName} call`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(log.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors focus:outline-none focus-visible:bg-muted",
                        // A failed call is the reason anyone opens this screen,
                        // so it is marked in the row itself, not just an icon.
                        !log.success &&
                          "bg-destructive/[0.03] hover:bg-destructive/[0.07]",
                      )}
                    >
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          year: "2-digit",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.serviceName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusCell log={log} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-mono text-xs",
                          durationTone(log.durationMs),
                        )}
                      >
                        {log.durationMs.toLocaleString()} ms
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate font-mono text-xs text-muted-foreground">
                        {log.errorMessage ? (
                          <span className="text-destructive">
                            {log.errorMessage}
                          </span>
                        ) : (
                          log.endpoint
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {!loading && !error && total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 pt-4 sm:flex-row sm:px-0">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{rangeStart}</span>
                –<span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
                <span className="font-medium text-foreground">
                  {total.toLocaleString()}
                </span>{" "}
                calls
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-1 text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PssLogDetailDialog
        logId={selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </main>
  );
}
