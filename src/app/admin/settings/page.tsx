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
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import AccountSecurity from "@/components/account-security";
import CardRequestFeeSettings from "@/components/card-request-fee-settings";
import {
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Save,
  Upload,
  UserCog,
  XCircle,
} from "lucide-react";
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
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Settings"
        description="Manage your own account security, self-service card requests, currency reference data, and which card products are available."
      />

      <AccountSecurity />

      <CardRequestFeeSettings />

      <form onSubmit={handleSaveSettings}>
        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
                <UserCog className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <CardTitle>Self card request</CardTitle>
                <CardDescription>
                  Configure whether users can request cards themselves when no
                  card is available
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <div className="space-y-1">
                <Label htmlFor="allowSelfCardRequest" className="text-base">
                  Allow self-initiated card requests
                </Label>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  When enabled, users can request a card if none is available.
                </p>
              </div>
              <Switch
                id="allowSelfCardRequest"
                checked={allowSelfCardRequest}
                onCheckedChange={setAllowSelfCardRequest}
                className="mt-1 shrink-0"
              />
            </div>

            {allowSelfCardRequest && (
              <div className="animate-fade-in-down space-y-2 rounded-lg border border-border bg-muted/40 p-4">
                <Label htmlFor="defaultChecker">
                  Default checker for self-initiated requests
                </Label>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  All self-initiated card requests will be assigned to this
                  checker.
                </p>
                <Select
                  value={defaultCheckerId}
                  onValueChange={setDefaultCheckerId}
                >
                  <SelectTrigger id="defaultChecker" className="w-full max-w-md">
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

            {/* Save Button — must stay inside this form (not nested with card programs) */}
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving&hellip;
                  </>
                ) : (
                  <>
                    <Save />
                    Save settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
              <Coins className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <CardTitle>Currency reference data</CardTitle>
              <CardDescription>
                Import currencies from Excel matching{" "}
                <span className="font-mono text-[0.8125rem] text-foreground">
                  currency.xls
                </span>{" "}
                (columns: CUR_IDE, CUR_LABE, CUR_ALPH_CODE). Transaction history
                maps PSS <span className="font-mono">Currency</span> (e.g. 840)
                via <span className="font-mono">CUR_IDE</span> to the alpha code
                for display.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {!loadingCurrencies && (
            <div className="flex items-center gap-2 rounded-lg border border-info/25 bg-info-muted px-3 py-2.5 text-sm text-info-muted-foreground">
              <Database className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold tabular-nums">
                  {currencyCount}
                </span>{" "}
                currency record{currencyCount === 1 ? "" : "s"} in database.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDownloadCurrencyTemplate()}
            >
              <Download />
              Download template
            </Button>
            <Button
              type="button"
              variant="secondary"
              asChild
              disabled={validatingCurrency}
            >
              <label className="flex cursor-pointer items-center">
                {validatingCurrency ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                {validatingCurrency ? "Validating…" : "Upload & validate"}
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
                <Loader2 className="animate-spin" />
              ) : (
                <Database />
              )}
              Import to database
            </Button>
          </div>

          {currencyFileName && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              Last file:{" "}
              <span className="truncate font-medium text-foreground">
                {currencyFileName}
              </span>
            </p>
          )}

          {currencySummary && (
            <div className="stagger-children grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total rows"
                value={currencySummary.totalRows}
                icon={ListChecks}
                tone="neutral"
              />
              <StatCard
                label="Valid"
                value={currencySummary.validRows}
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                label="Failed"
                value={currencySummary.failedRows}
                icon={XCircle}
                tone="danger"
              />
              <StatCard
                label="Duplicate CUR_IDE"
                value={currencySummary.duplicateRows}
                icon={Copy}
                tone="warning"
              />
            </div>
          )}

          {currencyImportRows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table
                containerClassName="max-h-72 overflow-y-auto"
                className="table-sticky-head"
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.curIde || "—"}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-sm">
                        {row.curLabel || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.curAlphaCode || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {currencyImportRows.length > 50 && (
                <p className="border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                  Showing first 50 of {currencyImportRows.length} rows.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
              <CreditCard className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <CardTitle>Card programs</CardTitle>
              <CardDescription>
                Control which card products Makers and self-initiated customers
                can choose when submitting a request. Disabled programs are
                hidden from request forms and rejected by the API. Checker
                approval compares customer cards against every BIN listed here
                (including disabled rows) to set customer type.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Add card program
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="newProgramCode">Program code</Label>
                <Input
                  id="newProgramCode"
                  inputMode="numeric"
                  placeholder="e.g. 32141"
                  value={newProgramCode}
                  onChange={(e) => setNewProgramCode(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newProgramName">Name</Label>
                <Input
                  id="newProgramName"
                  placeholder="Display name"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newProgramBin">BIN</Label>
                <Input
                  id="newProgramBin"
                  inputMode="numeric"
                  placeholder="e.g. 52624735"
                  value={newProgramBin}
                  onChange={(e) => setNewProgramBin(e.target.value)}
                  className="font-mono"
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
                  <Loader2 className="animate-spin" />
                  Adding&hellip;
                </>
              ) : (
                "Add program"
              )}
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {cardPrograms.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No card programs"
                description="Add a card program above to make it available for requests."
                compact
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>BIN</TableHead>
                    <TableHead className="text-center">Maker requests</TableHead>
                    <TableHead className="text-center">Self-initiated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardPrograms.map((p) => (
                    <TableRow key={p.code}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell className="max-w-xs font-medium">
                        {p.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.bin}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.enabledForMaker}
                          aria-label={`Enable ${p.name} for maker requests`}
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
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.enabledForSelf}
                          aria-label={`Enable ${p.name} for self-initiated requests`}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button
              type="button"
              disabled={savingPrograms}
              onClick={() => void handleSaveCardPrograms()}
            >
              {savingPrograms ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving&hellip;
                </>
              ) : (
                <>
                  <Save />
                  Save card programs
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
