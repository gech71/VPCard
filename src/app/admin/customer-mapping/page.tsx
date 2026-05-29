"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminNav from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Database,
  Upload,
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

function statusBadgeVariant(
  status: CustomerMappingImportRow["status"],
): "default" | "destructive" | "secondary" {
  if (status === "valid") return "default";
  if (status === "duplicate") return "secondary";
  return "destructive";
}

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

  const displayRows =
    importRows.length > 0 ? importRows : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            Prepaid Card Admin - Customer Mapping
          </h1>
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

      <AdminNav activePath="/admin/customer-mapping" />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Customer Mapping Import
          </h2>
          <p className="text-muted-foreground mt-1">
            Import NIB customer ID to PSS customer ID mappings from Excel
            (.xlsx). Format matches{" "}
            <span className="font-mono text-sm">MigrationReadyFor All.xlsx</span>{" "}
            (columns: NIBCustomerID, PSSCustomerID). A row is treated as a
            duplicate only when both NIBCusID and PSSCusId match exactly; the
            same NIB with a different PSS ID (or vice versa) is allowed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import file
            </CardTitle>
            <CardDescription>
              Download the template, fill in mappings, then upload for validation
              before writing to the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button type="button" variant="secondary" asChild disabled={validating}>
                <label className="cursor-pointer flex items-center">
                  {validating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {validating ? "Validating…" : "Upload & Validate"}
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    disabled={validating}
                    onChange={handleFileChange}
                  />
                </label>
              </Button>
              <Button
                type="button"
                disabled={
                  migrating || !summary || summary.validRows === 0
                }
                onClick={handleMigrate}
              >
                {migrating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Start Migration / Database Write
              </Button>
            </div>

            {fileName && (
              <p className="text-sm text-muted-foreground">
                Last file: <span className="font-medium">{fileName}</span>
              </p>
            )}

            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <SummaryCard label="Total rows" value={summary.totalRows} />
                <SummaryCard
                  label="Successful"
                  value={summary.validRows}
                  className="text-green-700"
                />
                <SummaryCard
                  label="Failed"
                  value={summary.failedRows}
                  className="text-red-700"
                />
                <SummaryCard
                  label="Duplicate pairs"
                  value={summary.duplicateRows}
                  className="text-amber-700"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {displayRows && (
          <Card>
            <CardHeader>
              <CardTitle>Import preview</CardTitle>
              <CardDescription>
                Review validated rows before starting migration.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>NIBCusID</TableHead>
                    <TableHead>PSSCusId</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.nibCusId || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.pssCusId || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md">
                        {row.errors.length > 0
                          ? row.errors.join(" ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Database mappings</CardTitle>
            <CardDescription>
              All customer ID mappings currently stored in the system (
              {loadingDb ? "…" : dbMappings.length} record
              {dbMappings.length === 1 ? "" : "s"}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDb ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : dbMappings.length === 0 ? (
              <Alert>
                <AlertTitle>No mappings yet</AlertTitle>
                <AlertDescription>
                  Import a file and run migration to populate customer mappings.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIBCusID</TableHead>
                      <TableHead>PSSCusId</TableHead>
                      <TableHead>Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbMappings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">
                          {m.nibCusId}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {m.pssCusId}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.updatedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${className}`}>{value}</p>
    </div>
  );
}
