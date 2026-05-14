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
 * If any listed card's clearpan starts with the program BIN, customer is treated as "O", else "N".
 */
export function resolveCustomertypeFromCardBins(
  cards: PssCardRow[],
  programBin: string | null | undefined,
): "O" | "N" {
  const bin = (programBin || "").trim();
  if (!bin) return "N";

  for (const card of cards) {
    const pan = String(card?.clearpan ?? "").trim();
    if (pan && pan.startsWith(bin)) return "O";
  }
  return "N";
}
