import type { CardDetails } from "@/lib/data";

/** Comma-separated BINs from NEXT_PUBLIC_ALLOWED_CARD_BINS */
export function parseAllowedCardBinsFromEnv(): string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_CARD_BINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clearpanMatchesAllowedBins(
  clearpan: string,
  bins: string[],
): boolean {
  const pan = String(clearpan ?? "").trim();
  if (!pan || bins.length === 0) return true;
  return bins.some((bin) => pan.startsWith(bin));
}

export function filterCardsByAllowedBins(
  cards: CardDetails[],
  bins: string[],
): CardDetails[] {
  if (bins.length === 0) return cards;
  return cards.filter((c) =>
    clearpanMatchesAllowedBins(String(c.fullNumber ?? ""), bins),
  );
}

export function filterProgramsNotOwnedByCustomerPans<
  T extends { bin: string },
>(programs: T[], customerPans: string[]): T[] {
  const pans = customerPans.map((p) => String(p ?? "").trim()).filter(Boolean);
  return programs.filter((prog) => {
    const bin = String(prog.bin ?? "").trim();
    if (!bin) return true;
    return !pans.some((pan) => pan.startsWith(bin));
  });
}
