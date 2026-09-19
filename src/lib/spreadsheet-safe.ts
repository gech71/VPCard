import * as XLSX from "xlsx";

/**
 * Opening an uploaded spreadsheet without trusting it.
 *
 * The upload endpoints check the filename and the byte count, neither of which
 * says anything about the content: a filename is attacker-controlled, and a
 * 5 MB cap bounds the *compressed* size of what is, for .xlsx, a ZIP archive.
 * A crafted workbook well inside that cap can inflate to gigabytes inside
 * XLSX.read() and take the server process down with it.
 *
 * So before parsing we check what the bytes actually are, and how much they
 * claim they will become.
 */

/** OOXML (.xlsx) is a ZIP archive - local file header. */
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Legacy .xls is an OLE2/CFB compound file, not a ZIP. */
const CFB_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

/** Absolute ceiling on what an upload may inflate to. */
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

/**
 * Generous for real spreadsheets - repetitive OOXML routinely hits 20-50x -
 * and far below what a zip bomb needs to be interesting.
 */
const MAX_COMPRESSION_RATIO = 200;

/**
 * Row ceiling, applied while parsing. Callers compare the sheet they get back
 * against this: a file that reaches the limit is rejected rather than silently
 * truncated, because quietly dropping rows from a customer-ID migration would
 * be worse than refusing the file.
 */
export const MAX_SHEET_ROWS = 100_000;

export type OpenSpreadsheetResult =
  | { workbook: XLSX.WorkBook; error?: undefined }
  | { workbook?: undefined; error: string };

/**
 * Sums the uncompressed sizes every entry declares in the ZIP central
 * directory. Reading the declaration is the point: it tells us what the archive
 * will cost to expand before we spend anything expanding it.
 *
 * Returns null when the central directory cannot be read.
 */
function declaredUncompressedSize(buffer: Buffer): number | null {
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_SIGNATURE = 0x02014b50;

  // The end-of-central-directory record sits at the back, after a comment of
  // at most 64 KB.
  const searchLimit = Math.min(buffer.length, 0xffff + 22);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= buffer.length - searchLimit; i--) {
    if (i < 0) break;
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let total = 0;

  for (let n = 0; n < entryCount; n++) {
    if (offset + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) return null;

    total += buffer.readUInt32LE(offset + 24);

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return total;
}

/**
 * Validates an uploaded buffer really is a spreadsheet, bounds what it may cost
 * to expand, and parses it. Returns a plain error string so callers can hand it
 * straight back without leaking parser internals.
 */
export function openSpreadsheet(buffer: Buffer): OpenSpreadsheetResult {
  const isZip = buffer.subarray(0, 4).equals(ZIP_SIGNATURE);
  const isCfb = buffer.subarray(0, 8).equals(CFB_SIGNATURE);

  if (!isZip && !isCfb) {
    return {
      error:
        "That file is not a spreadsheet. Upload the .xlsx template rather than a renamed file of another type.",
    };
  }

  // Only the ZIP-based formats can be a decompression bomb; a legacy .xls is
  // stored uncompressed, so there is nothing to inflate.
  if (isZip) {
    const declared = declaredUncompressedSize(buffer);

    if (declared === null) {
      return {
        error:
          "That workbook's archive directory could not be read, so it may be corrupt. Re-export it and try again.",
      };
    }

    if (
      declared > MAX_UNCOMPRESSED_BYTES ||
      declared > buffer.length * MAX_COMPRESSION_RATIO
    ) {
      return {
        error:
          "That workbook expands to far more data than its size suggests and was not opened.",
      };
    }
  }

  try {
    // One past the ceiling, so callers can tell "at the limit" from "over it".
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      sheetRows: MAX_SHEET_ROWS + 1,
    });
    return { workbook };
  } catch {
    return {
      error: "That file could not be read as a spreadsheet.",
    };
  }
}
