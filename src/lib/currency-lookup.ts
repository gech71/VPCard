import prisma from "@/lib/prisma";
import { normalizeCurIde } from "@/lib/currency-import";

export type CurrencyDisplay = {
  curIde: string;
  curLabel: string;
  curAlphaCode: string;
};

const FALLBACK_ALPHA = "USD";

/** Load all currencies keyed by normalized CUR_IDE. */
export async function getCurrencyMapByIde(): Promise<
  Map<string, CurrencyDisplay>
> {
  const rows = await prisma.currency.findMany({
    select: { curIde: true, curLabel: true, curAlphaCode: true },
  });

  const map = new Map<string, CurrencyDisplay>();
  for (const row of rows) {
    map.set(row.curIde, row);
  }
  return map;
}

/**
 * PSS GetLastNTransaction returns numeric currency as `Currency` (e.g. "840").
 * Reference import uses `CUR_IDE` — both normalize to the same lookup key.
 */
export function extractCurIdeFromTransaction(
  tx: Record<string, unknown>,
): string | undefined {
  const raw =
    tx.Currency ??
    tx.currency ??
    tx.CUR_IDE ??
    tx.cur_ide ??
    tx.CurIde ??
    tx["Currency"] ??
    tx["CUR_IDE"] ??
    tx["cur_ide"];

  if (raw == null || raw === "") return undefined;
  return normalizeCurIde(String(raw));
}

export function resolveCurrencyFromMap(
  map: Map<string, CurrencyDisplay>,
  curIde: string | undefined,
): CurrencyDisplay {
  if (curIde) {
    const hit = map.get(curIde);
    if (hit) return hit;
  }

  return {
    curIde: curIde ?? "",
    curLabel: "Unknown currency",
    curAlphaCode: FALLBACK_ALPHA,
  };
}
