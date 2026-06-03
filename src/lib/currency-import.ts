import * as XLSX from "xlsx";

export type CurrencyImportRowStatus = "valid" | "invalid" | "duplicate";

export type CurrencyImportRow = {
  rowNumber: number;
  curIde: string;
  curLabel: string;
  curAlphaCode: string;
  status: CurrencyImportRowStatus;
  errors: string[];
};

export type CurrencyImportSummary = {
  totalRows: number;
  validRows: number;
  failedRows: number;
  duplicateRows: number;
};

export type CurrencyParseResult = {
  rows: CurrencyImportRow[];
  summary: CurrencyImportSummary;
  fileError?: string;
};

const TEMPLATE_HEADERS = ["CUR_IDE", "CUR_LABE", "CUR_ALPH_CODE"] as const;

/** Normalize PSS numeric currency id (e.g. 4 → 004, 840 → 840). */
export function normalizeCurIde(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(3, "0");
  }
  return trimmed;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i]);
    if (aliases.includes(h)) return i;
  }
  return -1;
}

function cellValue(row: unknown[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  const raw = row[index];
  if (raw == null) return "";
  return String(raw).trim();
}

export function buildCurrencyTemplateBuffer(): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    ["840", "U.S. DollarS", "USD"],
    ["978", "euroS", "EUR"],
    ["230", "Ethiopian Birr", "ETB"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "currency");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseAndValidateCurrencyFile(buffer: Buffer): CurrencyParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  if (matrix.length === 0) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
    };
  }

  const headerRow = (matrix[0] ?? []).map((c) => String(c ?? ""));
  const ideIndex = findColumnIndex(headerRow, ["curide"]);
  const labelIndex = findColumnIndex(headerRow, ["curlabe", "curlabel"]);
  const alphaIndex = findColumnIndex(headerRow, ["curalphcode", "curalphacode"]);

  if (ideIndex < 0 || labelIndex < 0 || alphaIndex < 0) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
      fileError:
        "Invalid file: required columns CUR_IDE, CUR_LABE, and CUR_ALPH_CODE are missing.",
    };
  }

  const rows: CurrencyImportRow[] = [];
  const seenIde = new Map<string, number[]>();

  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    const curIdeRaw = cellValue(raw, ideIndex);
    const curLabel = cellValue(raw, labelIndex);
    const curAlphaCode = cellValue(raw, alphaIndex).toUpperCase();

    if (!curIdeRaw && !curLabel && !curAlphaCode) continue;

    const rowNumber = i + 1;
    const errors: string[] = [];
    const curIde = curIdeRaw ? normalizeCurIde(curIdeRaw) : "";

    if (!curIde) errors.push("Missing CUR_IDE.");
    if (!curLabel) errors.push("Missing CUR_LABE.");
    if (!curAlphaCode) errors.push("Missing CUR_ALPH_CODE.");
    else if (!/^[A-Z]{3}$/.test(curAlphaCode)) {
      errors.push("Invalid CUR_ALPH_CODE (must be 3 letters).");
    }
    if (errors.length > 0) {
      errors.unshift("Invalid row.");
    }

    const row: CurrencyImportRow = {
      rowNumber,
      curIde,
      curLabel,
      curAlphaCode,
      status: errors.length > 0 ? "invalid" : "valid",
      errors,
    };
    rows.push(row);

    if (curIde) {
      const list = seenIde.get(curIde) ?? [];
      list.push(rowNumber);
      seenIde.set(curIde, list);
    }
  }

  for (const row of rows) {
    if (row.status === "invalid" || !row.curIde) continue;
    const occurrences = seenIde.get(row.curIde) ?? [];
    if (occurrences.length <= 1) continue;

    row.status = "duplicate";
    const others = occurrences.filter((n) => n !== row.rowNumber);
    row.errors.push(
      `Duplicate CUR_IDE (also on row${others.length > 1 ? "s" : ""} ${others.join(", ")}).`,
    );
  }

  const summary: CurrencyImportSummary = {
    totalRows: rows.length,
    validRows: rows.filter((r) => r.status === "valid").length,
    failedRows: rows.filter((r) => r.status === "invalid").length,
    duplicateRows: rows.filter((r) => r.status === "duplicate").length,
  };

  return { rows, summary };
}

export function getValidCurrenciesForImport(
  rows: CurrencyImportRow[],
): { curIde: string; curLabel: string; curAlphaCode: string }[] {
  const seen = new Set<string>();
  const out: { curIde: string; curLabel: string; curAlphaCode: string }[] = [];

  for (const row of rows) {
    if (row.status !== "valid") continue;
    if (seen.has(row.curIde)) continue;
    seen.add(row.curIde);
    out.push({
      curIde: row.curIde,
      curLabel: row.curLabel,
      curAlphaCode: row.curAlphaCode,
    });
  }

  return out;
}
