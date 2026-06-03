"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Download, Upload, Database, Coins } from "lucide-react";
import type {
  CurrencyImportRow,
  CurrencyImportSummary,
} from "@/lib/currency-import";

interface Checker {
  id: string;
  email: string;
}

interface CardProgramRow {
  code: string;
  name: string;
  bin: string;
  enabledForMaker: boolean;
  enabledForSelf: boolean;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkers, setCheckers] = useState<Checker[]>([]);

  // Settings state
  const [allowSelfCardRequest, setAllowSelfCardRequest] = useState(false);
  const [defaultCheckerId, setDefaultCheckerId] = useState("");
  const [cardPrograms, setCardPrograms] = useState<CardProgramRow[]>([]);
  const [savingPrograms, setSavingPrograms] = useState(false);
  const [newProgramCode, setNewProgramCode] = useState("");
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramBin, setNewProgramBin] = useState("");
  const [addingProgram, setAddingProgram] = useState(false);

  const [currencyCount, setCurrencyCount] = useState(0);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [validatingCurrency, setValidatingCurrency] = useState(false);
  const [importingCurrency, setImportingCurrency] = useState(false);
  const [currencyImportRows, setCurrencyImportRows] = useState<
    CurrencyImportRow[]
  >([]);
  const [currencySummary, setCurrencySummary] =
    useState<CurrencyImportSummary | null>(null);
  const [currencyFileName, setCurrencyFileName] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    void loadCurrencyCount();
  }, []);

  async function loadCurrencyCount() {
    try {
      const res = await fetch("/api/admin/currencies");
      const data = await res.json();
      if (res.ok) {
        setCurrencyCount(data.count ?? 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingCurrencies(false);
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();

      if (res.ok) {
        setCheckers(data.checkers || []);
        setAllowSelfCardRequest(data.settings?.allowSelfCardRequest === "true");
        setDefaultCheckerId(data.settings?.defaultCheckerId || "");
        setCardPrograms(data.cardPrograms || []);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch settings",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowSelfCardRequest,
          defaultCheckerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to save settings",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCardPrograms() {
    setSavingPrograms(true);
    try {
      const res = await fetch("/api/admin/card-programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programs: cardPrograms.map((p) => ({
            code: p.code,
            enabledForMaker: p.enabledForMaker,
            enabledForSelf: p.enabledForSelf,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to save card programs",
        });
        return;
      }
      if (data.cardPrograms) {
        setCardPrograms(data.cardPrograms);
      }
      toast({
        title: "Success",
        description: "Card program availability updated",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSavingPrograms(false);
    }
  }

  async function handleDownloadCurrencyTemplate() {
    try {
      const res = await fetch("/api/admin/currencies/template");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "currency-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not download currency template.",
      });
    }
  }

  async function handleCurrencyFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidatingCurrency(true);
    setCurrencyFileName(file.name);
    setCurrencyImportRows([]);
    setCurrencySummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/currencies/validate", {
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

      setCurrencyImportRows(data.rows || []);
      setCurrencySummary(data.summary || null);
      toast({
        title: "Currency file validated",
        description: `${data.summary?.validRows ?? 0} row(s) ready to import.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during validation.",
      });
    } finally {
      setValidatingCurrency(false);
      e.target.value = "";
    }
  }

  async function handleCurrencyImport() {
    if (!currencySummary || currencySummary.validRows === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to import",
        description: "Upload and validate a file with at least one valid row.",
      });
      return;
    }

    setImportingCurrency(true);
    try {
      const res = await fetch("/api/admin/currencies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: currencyImportRows }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Import failed",
          description: data.error || "Could not save currencies.",
        });
        return;
      }

      toast({
        title: "Currency import complete",
        description: data.message,
      });
      setCurrencyImportRows([]);
      setCurrencySummary(null);
      setCurrencyFileName(null);
      setLoadingCurrencies(true);
      await loadCurrencyCount();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during import.",
      });
    } finally {
      setImportingCurrency(false);
    }
  }

  function currencyStatusVariant(
    status: CurrencyImportRow["status"],
  ): "default" | "destructive" | "secondary" {
    if (status === "valid") return "default";
    if (status === "duplicate") return "secondary";
    return "destructive";
  }

  async function handleAddCardProgram() {
    const code = newProgramCode.trim();
    const name = newProgramName.trim();
    const bin = newProgramBin.trim();
    if (!code || !name || !bin) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Enter program code, name, and BIN.",
      });
      return;
    }

    setAddingProgram(true);
    try {
      const res = await fetch("/api/admin/card-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, bin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to add card program",
        });
        return;
      }
      if (data.cardPrograms) {
        setCardPrograms(data.cardPrograms);
      }
      setNewProgramCode("");
      setNewProgramName("");
      setNewProgramBin("");
      toast({
        title: "Success",
        description: "Card program added",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setAddingProgram(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-primary text-primary-foreground">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">
              Prepaid Card Admin - Super Admin
            </h1>
          </div>
        </header>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            Prepaid Card Admin - Super Admin
          </h1>
          <div className="flex items-center gap-4">
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
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
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
              href="/admin/customer-mapping"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Customer Mapping
            </a>
            <a
              href="/admin/settings"
              className="py-4 px-2 border-b-2 border-primary font-medium text-primary"
            >
              Settings
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Self Card Request Setting */}
            <Card>
              <CardHeader>
                <CardTitle>Self Card Request</CardTitle>
                <CardDescription>
                  Configure whether users can request cards themselves when no
                  card is available
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="allowSelfCardRequest">
                      Allow Self-Initiated Card Requests
                    </Label>
                    <p className="text-sm text-gray-500">
                      When enabled, users can request a card if none is
                      available
                    </p>
                  </div>
                  <Switch
                    id="allowSelfCardRequest"
                    checked={allowSelfCardRequest}
                    onCheckedChange={setAllowSelfCardRequest}
                  />
                </div>

                {allowSelfCardRequest && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="defaultChecker">
                      Default Checker for Self-Initiated Requests
                    </Label>
                    <p className="text-sm text-gray-500">
                      All self-initiated card requests will be assigned to this
                      checker
                    </p>
                    <Select
                      value={defaultCheckerId}
                      onValueChange={setDefaultCheckerId}
                    >
                      <SelectTrigger className="w-full max-w-md">
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
                )}
              </CardContent>
            </Card>

            {/* Save Button — must stay inside this form (not nested with card programs) */}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Currency reference data
              </CardTitle>
              <CardDescription>
                Import currencies from Excel matching{" "}
                <span className="font-mono text-sm">currency.xls</span> (columns:{" "}
                CUR_IDE, CUR_LABE, CUR_ALPH_CODE). Transaction history maps PSS{" "}
                <span className="font-mono">Currency</span> (e.g. 840) via{" "}
                <span className="font-mono">CUR_IDE</span> to the alpha code for
                display.
                {!loadingCurrencies && (
                  <span className="block mt-1">
                    {currencyCount} currency record
                    {currencyCount === 1 ? "" : "s"} in database.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDownloadCurrencyTemplate()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                  disabled={validatingCurrency}
                >
                  <label className="cursor-pointer flex items-center">
                    {validatingCurrency ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {validatingCurrency ? "Validating…" : "Upload & Validate"}
                    <input
                      type="file"
                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      disabled={validatingCurrency}
                      onChange={handleCurrencyFileChange}
                    />
                  </label>
                </Button>
                <Button
                  type="button"
                  disabled={
                    importingCurrency ||
                    !currencySummary ||
                    currencySummary.validRows === 0
                  }
                  onClick={() => void handleCurrencyImport()}
                >
                  {importingCurrency ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Import to Database
                </Button>
              </div>

              {currencyFileName && (
                <p className="text-sm text-muted-foreground">
                  Last file:{" "}
                  <span className="font-medium">{currencyFileName}</span>
                </p>
              )}

              {currencySummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <CurrencySummaryBox
                    label="Total rows"
                    value={currencySummary.totalRows}
                  />
                  <CurrencySummaryBox
                    label="Valid"
                    value={currencySummary.validRows}
                    className="text-green-700"
                  />
                  <CurrencySummaryBox
                    label="Failed"
                    value={currencySummary.failedRows}
                    className="text-red-700"
                  />
                  <CurrencySummaryBox
                    label="Duplicate CUR_IDE"
                    value={currencySummary.duplicateRows}
                    className="text-amber-700"
                  />
                </div>
              )}

              {currencyImportRows.length > 0 && (
                <div className="overflow-x-auto max-h-64 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Row</TableHead>
                        <TableHead>CUR_IDE</TableHead>
                        <TableHead>CUR_LABE</TableHead>
                        <TableHead>CUR_ALPH_CODE</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currencyImportRows.slice(0, 50).map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.curIde || "—"}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {row.curLabel || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.curAlphaCode || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={currencyStatusVariant(row.status)}>
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {currencyImportRows.length > 50 && (
                    <p className="text-xs text-muted-foreground p-2">
                      Showing first 50 of {currencyImportRows.length} rows.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Card programs</CardTitle>
              <CardDescription>
                Control which card products Makers and self-initiated customers
                can choose when submitting a request. Disabled programs are
                hidden from request forms and rejected by the API. Checker
                approval compares customer cards against every BIN listed here
                (including disabled rows) to set customer type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Add card program</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="newProgramCode">Program code</Label>
                      <Input
                        id="newProgramCode"
                        inputMode="numeric"
                        placeholder="e.g. 32141"
                        value={newProgramCode}
                        onChange={(e) => setNewProgramCode(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <Label htmlFor="newProgramName">Name</Label>
                      <Input
                        id="newProgramName"
                        placeholder="Display name"
                        value={newProgramName}
                        onChange={(e) => setNewProgramName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newProgramBin">BIN</Label>
                      <Input
                        id="newProgramBin"
                        inputMode="numeric"
                        placeholder="e.g. 52624735"
                        value={newProgramBin}
                        onChange={(e) => setNewProgramBin(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={addingProgram}
                    onClick={() => void handleAddCardProgram()}
                  >
                    {addingProgram ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding…
                      </>
                    ) : (
                      "Add program"
                    )}
                  </Button>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 text-left">
                        <tr>
                          <th className="p-3 font-medium">Code</th>
                          <th className="p-3 font-medium">Name</th>
                          <th className="p-3 font-medium">BIN</th>
                          <th className="p-3 font-medium text-center">
                            Maker requests
                          </th>
                          <th className="p-3 font-medium text-center">
                            Self-initiated
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cardPrograms.map((p) => (
                          <tr key={p.code} className="border-t">
                            <td className="p-3 font-mono">{p.code}</td>
                            <td className="p-3 max-w-xs">{p.name}</td>
                            <td className="p-3 font-mono">{p.bin}</td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={p.enabledForMaker}
                                onCheckedChange={(v) =>
                                  setCardPrograms((rows) =>
                                    rows.map((r) =>
                                      r.code === p.code
                                        ? { ...r, enabledForMaker: v }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={p.enabledForSelf}
                                onCheckedChange={(v) =>
                                  setCardPrograms((rows) =>
                                    rows.map((r) =>
                                      r.code === p.code
                                        ? { ...r, enabledForSelf: v }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
                <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={savingPrograms}
                      onClick={() => void handleSaveCardPrograms()}
                    >
                      {savingPrograms ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save card programs
                        </>
                      )}
                    </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function CurrencySummaryBox({
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
