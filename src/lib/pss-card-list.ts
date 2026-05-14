import { fetchPss } from "@/lib/pss-fetch";

type PssCardRow = { clearpan?: string };

/**
 * Card list request using only customer id and institution in the filter
 * (other filter fields empty; pagination range only).
 */
export async function fetchPssCardListByCustomerId(params: {
  customerId: string;
  institution: string;
  cardListUrl: string;
  apiKey: string;
  idmsg: string;
}): Promise<PssCardRow[]> {
  const cardListResponse = await fetchPss(params.cardListUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: params.apiKey,
    },
    body: JSON.stringify({
      header: { idmsg: params.idmsg },
      filter: {
        account: "",
        card: "",
        pan: "",
        customer: params.customerId,
        name_on_card: "",
        institution: params.institution,
        start: "1",
        end: "50",
      },
    }),
    cache: "no-store",
  });

  if (!cardListResponse.ok) return [];

  const cardListData = await cardListResponse.json();
  const cards = cardListData?.response?.body?.cards;
  if (!cards || !Array.isArray(cards)) return [];
  return cards as PssCardRow[];
}

/**
 * Collect unique non-empty BIN prefixes from all configured card programs
 * (caller should load from DB regardless of enable flags).
 */
export function normalizeConfiguredBins(bins: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of bins) {
    const t = String(b ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * If any listed card's clearpan starts with any configured BIN, customer is "O", else "N".
 */
export function resolveCustomertypeFromCardBins(
  cards: PssCardRow[],
  configuredBins: string[],
): "O" | "N" {
  const bins = normalizeConfiguredBins(configuredBins);
  if (bins.length === 0) return "N";

  for (const card of cards) {
    const pan = String(card?.clearpan ?? "").trim();
    if (!pan) continue;
    for (const bin of bins) {
      if (pan.startsWith(bin)) return "O";
    }
  }
  return "N";
}
