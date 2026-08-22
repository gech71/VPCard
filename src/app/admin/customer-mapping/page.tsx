"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Search,
  SearchX,
  Upload,
  XCircle,
} from "lucide-react";
import type {
  CustomerMappingImportRow,
  CustomerMappingImportSummary,
} from "@/lib/customer-mapping-import";

type DbMapping = {
  id: string;
  nibCusId: string;
  pssCusId: string;
  updatedAt: string;
};

export default function CustomerMappingImportPage() {
  const { toast } = useToast();
  const [dbMappings, setDbMappings] = useState<DbMapping[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [validating, setValidating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [importRows, setImportRows] = useState<CustomerMappingImportRow[]>([]);
  const [summary, setSummary] = useState<CustomerMappingImportSummary | null>(
    null,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  // Presentation-only search across mappings already loaded.
  const [mappingFilter, setMappingFilter] = useState("");

  const loadDbMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/customer-mapping");
      const data = await res.json();
      if (res.ok) {
        setDbMappings(data.mappings || []);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load existing mappings.",
      });
    } finally {
      setLoadingDb(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDbMappings();
  }, [loadDbMappings]);

  async function handleDownloadTemplate() {
    try {
      const res = await fetch("/api/admin/customer-mapping/template");
      if (!res.ok) {
        throw new Error("Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customer-mapping-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not download template.",
      });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidating(true);
    setFileName(file.name);
    setImportRows([]);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/customer-mapping/validate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Validation failed",
          description: data.error || "Could not validate file.",
        });
        return;
      }

      setImportRows(data.rows || []);
      setSummary(data.summary || null);
      toast({
        title: "File validated",
        description: `${data.summary?.validRows ?? 0} row(s) ready for migration.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during validation.",
      });
    } finally {
      setValidating(false);
      e.target.value = "";
    }
  }

  async function handleMigrate() {
    if (!summary || summary.validRows === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to migrate",
        description: "Upload and validate a file with at least one valid row.",
      });
      return;
    }

    setMigrating(true);
    try {
      const res = await fetch("/api/admin/customer-mapping/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Migration failed",
          description: data.error || "Could not save mappings.",
        });
        return;
      }

      const allAlreadyInDb =
        data.rowsWritten === 0 && (data.rowsSkippedExisting ?? 0) > 0;

      toast({
        title: allAlreadyInDb ? "Nothing new to import" : "Migration complete",
        description: data.message,
      });
      setImportRows([]);
      setSummary(null);
      setFileName(null);
      setLoadingDb(true);
      await loadDbMappings();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during migration.",
      });
    } finally {
      setMigrating(false);
    }
  }

  const filteredMappings = useMemo(() => {
    const term = mappingFilter.trim().toLowerCase();
    if (!term) return dbMappings;
    return dbMappings.filter(
      (m) =>
        m.nibCusId.toLowerCase().includes(term) ||
        m.pssCusId.toLowerCase().includes(term),
    );
  }, [dbMappings, mappingFilter]);

  const dbPagination = usePagination(filteredMappings, 25);
  const previewPagination = usePagination(importRows, 25);

  const canMigrate = Boolean(summary && summary.validRows > 0);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Customer mapping import"
        description={
          <>
            Import NIB customer ID to PSS customer ID mappings from Excel
            (.xlsx). Format matches{" "}
            <span className="font-mono text-[0.8125rem] text-foreground">
              MigrationReadyFor All.xlsx
            </span>{" "}
            (columns: NIBCustomerID, PSSCustomerID). A row is treated as a
            duplicate only when both NIBCusID and PSSCusId match exactly; the
            same NIB with a different PSS ID (or vice versa) is allowed.
          </>
        }
      />

      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <CardTitle>Import file</CardTitle>
              <CardDescription>
                Download the template, fill in mappings, then upload for
                validation before writing to the database.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <li className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Get the template
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                >
                  <Download />
                  Download
                </Button>
              </div>
            </li>

            <li className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Upload &amp; validate
                </p>
                <Button type="button" variant="secondary" size="sm" asChild disabled={validating}>
                  <label className="flex cursor-pointer items-center">
                    {validating ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Upload />
                    )}
                    {validating ? "Validating…" : "Choose file"}
                    <input
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      disabled={validating}
                      onChange={handleFileChange}
                    />
                  </label>
                </Button>
              </div>
            </li>

            <li className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  canMigrate
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-foreground/25 text-muted-foreground"
                }`}
              >
                3
              </span>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Write to database
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={migrating || !canMigrate}
                  onClick={handleMigrate}
                >
                  {migrating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Database />
                  )}
                  Start migration
                </Button>
              </div>
            </li>
          </ol>

          {fileName && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              Last file:{" "}
              <span className="truncate font-medium text-foreground">
                {fileName}
              </span>
            </p>
          )}

          {summary && (
            <div className="stagger-children grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total rows"
                value={summary.totalRows}
                icon={ListChecks}
                tone="neutral"
              />
              <StatCard
                label="Successful"
                value={summary.validRows}
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                label="Failed"
                value={summary.failedRows}
                icon={XCircle}
                tone="danger"
              />
              <StatCard
                label="Duplicate pairs"
                value={summary.duplicateRows}
                icon={Copy}
                tone="warning"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {importRows.length > 0 && (
        <Card className="animate-fade-in-up overflow-hidden">
          <CardHeader>
            <CardTitle>Import preview</CardTitle>
            <CardDescription>
              Review validated rows before starting migration.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table containerClassName="max-h-[30rem] overflow-y-auto" className="table-sticky-head">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>NIBCusID</TableHead>
                  <TableHead>PSSCusId</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewPagination.pageItems.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.nibCusId || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.pssCusId || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">
                      {row.errors.length > 0 ? row.errors.join(" ") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataPagination
              pagination={previewPagination}
              itemLabel="rows"
              pageSizeOptions={[25, 50, 100]}
            />
          </CardContent>
        </Card>
      )}

      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-0.5">
            <CardTitle>Database mappings</CardTitle>
            <CardDescription>
              All customer ID mappings currently stored in the system (
              {loadingDb ? "…" : dbMappings.length} record
              {dbMappings.length === 1 ? "" : "s"}).
            </CardDescription>
          </div>
          {!loadingDb && dbMappings.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={mappingFilter}
                onChange={(e) => setMappingFilter(e.target.value)}
                placeholder="Search customer IDs"
                aria-label="Search customer mappings"
                className="h-9 pl-9"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loadingDb ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>NIBCusID</TableHead>
                  <TableHead>PSSCusId</TableHead>
                  <TableHead>Last updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton columns={3} rows={6} />
              </TableBody>
            </Table>
          ) : dbMappings.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No mappings yet"
              description="Import a file and run migration to populate customer mappings."
            />
          ) : filteredMappings.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching mappings"
              description={`Nothing matches “${mappingFilter}”.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMappingFilter("")}
                >
                  Clear search
                </Button>
              }
            />
          ) : (
            <>
              <Table containerClassName="max-h-[30rem] overflow-y-auto" className="table-sticky-head">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>NIBCusID</TableHead>
                    <TableHead>PSSCusId</TableHead>
                    <TableHead>Last updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbPagination.pageItems.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-sm">
                        {m.nibCusId}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.pssCusId}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(m.updatedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataPagination
                pagination={dbPagination}
                itemLabel="mappings"
                pageSizeOptions={[25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
