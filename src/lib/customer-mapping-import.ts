import * as XLSX from "xlsx";

import { MAX_SHEET_ROWS, openSpreadsheet } from "@/lib/spreadsheet-safe";

export type ImportRowStatus = "valid" | "invalid" | "duplicate";

export type CustomerMappingImportRow = {
  rowNumber: number;
  nibCusId: string;
  pssCusId: string;
  status: ImportRowStatus;
  errors: string[];
};

export type CustomerMappingImportSummary = {
  totalRows: number;
  validRows: number;
  failedRows: number;
  duplicateRows: number;
};

export type CustomerMappingParseResult = {
  rows: CustomerMappingImportRow[];
  summary: CustomerMappingImportSummary;
  fileError?: string;
};

const TEMPLATE_HEADERS = ["NIBCustomerID", "PSSCustomerID"] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumnIndex(
  headers: string[],
  aliases: string[],
): number {
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

/** Composite key for (NIBCusID, PSSCusId) pair equality. */
export function compositeMappingKey(nibCusId: string, pssCusId: string): string {
  return `${nibCusId}\u0000${pssCusId}`;
}

export function buildCustomerMappingTemplateBuffer(): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    ["1006532367", "00002P00093257"],
    ["1003437123", "00002P00117861"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export type CustomerMappingPair = {
  rowNumber: number;
  nibCusId: string;
  pssCusId: string;
};

/**
 * Decides which rows are importable, from the values alone.
 *
 * This is the single definition of "valid" for customer mappings. The file
 * parser uses it, and so does the migration path - which matters, because the
 * migration path receives its rows as JSON from the browser. A row arriving
 * with status:"valid" is a claim by the client, not evidence, so the claim is
 * discarded and the verdict recomputed here from nibCusId and pssCusId.
 */
export function classifyRows(
  pairs: CustomerMappingPair[],
): CustomerMappingImportRow[] {
  const rows: CustomerMappingImportRow[] = [];
  const seenComposite = new Map<string, number[]>();

  for (const { rowNumber, nibCusId, pssCusId } of pairs) {
    const errors: string[] = [];

    if (!nibCusId) errors.push("Missing NIBCusID.");
    if (!pssCusId) errors.push("Missing PSSCusId.");
    if (errors.length > 0) {
      errors.unshift("Invalid row.");
    }

    rows.push({
      rowNumber,
      nibCusId,
      pssCusId,
      status: errors.length > 0 ? "invalid" : "valid",
      errors,
    });

    if (nibCusId && pssCusId) {
      const key = compositeMappingKey(nibCusId, pssCusId);
      const list = seenComposite.get(key) ?? [];
      list.push(rowNumber);
      seenComposite.set(key, list);
    }
  }

  for (const row of rows) {
    if (row.status === "invalid") continue;
    if (!row.nibCusId || !row.pssCusId) continue;

    const key = compositeMappingKey(row.nibCusId, row.pssCusId);
    const occurrences = seenComposite.get(key) ?? [];
    if (occurrences.length <= 1) continue;

    row.status = "duplicate";
    const others = occurrences.filter((n) => n !== row.rowNumber);
    row.errors.push(
      `Duplicate composite mapping: identical NIBCusID and PSSCusId pair (also on row${others.length > 1 ? "s" : ""} ${others.join(", ")}).`,
    );
  }

  return rows;
}

export function parseAndValidateCustomerMappingFile(
  buffer: Buffer,
): CustomerMappingParseResult {
  const opened = openSpreadsheet(buffer);
  if (!opened.workbook) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
      fileError: opened.error,
    };
  }

  const workbook = opened.workbook;
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

  // Refuse rather than silently import a truncated migration.
  if (matrix.length > MAX_SHEET_ROWS) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
      fileError: `That file has more than ${MAX_SHEET_ROWS.toLocaleString()} rows. Split it into smaller files and import them in turn.`,
    };
  }

  if (matrix.length === 0) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
    };
  }

  const headerRow = (matrix[0] ?? []).map((c) => String(c ?? ""));
  const nibIndex = findColumnIndex(headerRow, ["nibcusid", "nibcustomerid"]);
  const pssIndex = findColumnIndex(headerRow, ["psscusid", "psscustomerid"]);

  if (nibIndex < 0 || pssIndex < 0) {
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, failedRows: 0, duplicateRows: 0 },
      fileError:
        "Invalid file: required columns NIBCustomerID and PSSCustomerID are missing.",
    };
  }

  const pairs: CustomerMappingPair[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    const nibCusId = cellValue(raw, nibIndex);
    const pssCusId = cellValue(raw, pssIndex);

    if (!nibCusId && !pssCusId) continue;

    pairs.push({ rowNumber: i + 1, nibCusId, pssCusId });
  }

  const rows = classifyRows(pairs);

  const summary: CustomerMappingImportSummary = {
    totalRows: rows.length,
    validRows: rows.filter((r) => r.status === "valid").length,
    failedRows: rows.filter((r) => r.status === "invalid").length,
    duplicateRows: rows.filter((r) => r.status === "duplicate").length,
  };

  return { rows, summary };
}

export function getValidRowsForMigration(
  rows: CustomerMappingImportRow[],
): { nibCusId: string; pssCusId: string }[] {
  // Re-classify before trusting anything. `rows` comes off the wire, so the
  // status and errors on it were written by the caller, not by the parser -
  // reading them here would let a client mark arbitrary pairs importable and
  // write mappings that no uploaded file ever contained. Values are trimmed to
  // match what cellValue() produces, so " " cannot pass as a populated field.
  const classified = classifyRows(
    rows.map((row) => ({
      rowNumber: row.rowNumber,
      nibCusId: (row.nibCusId ?? "").trim(),
      pssCusId: (row.pssCusId ?? "").trim(),
    })),
  );

  const seen = new Set<string>();
  const out: { nibCusId: string; pssCusId: string }[] = [];

  for (const row of classified) {
    if (row.status !== "valid") continue;
    const key = compositeMappingKey(row.nibCusId, row.pssCusId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nibCusId: row.nibCusId, pssCusId: row.pssCusId });
  }

  return out;
}
