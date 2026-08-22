import prisma from "@/lib/prisma";

/**
 * Settings keys for the Guest card-request fee. Stored in the existing Settings
 * table so the fee is configurable at runtime - changing it never needs a code
 * change or a redeploy.
 */
export const FEE_KEYS = {
  paymentRequired: "cardRequestPaymentRequired",
  amount: "cardRequestFeeAmount",
  currency: "cardRequestFeeCurrency",
  active: "cardRequestFeeActive",
} as const;

export const DEFAULT_FEE_CURRENCY = "ETB";

export type CardRequestFeeConfig = {
  /** The Super Admin's master ON/OFF switch. */
  paymentRequired: boolean;
  /** Secondary Active/Inactive state of the fee configuration. */
  active: boolean;
  amount: number;
  currency: string;
  /**
   * What actually governs a Guest request. Both switches must be on and the
   * amount must be positive - anything else falls back to free, so a
   * half-finished configuration can never start charging people by accident.
   */
  paymentEnforced: boolean;
};

function parseAmount(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getCardRequestFeeConfig(): Promise<CardRequestFeeConfig> {
  const rows = await prisma.settings.findMany({
    where: { key: { in: Object.values(FEE_KEYS) } },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const paymentRequired = map.get(FEE_KEYS.paymentRequired) === "true";
  // Defaults to active so that switching Payment Required on is enough on a
  // fresh install; the Status switch is there to park a configured fee.
  const active = (map.get(FEE_KEYS.active) ?? "true") === "true";
  const amount = parseAmount(map.get(FEE_KEYS.amount));
  const currency = map.get(FEE_KEYS.currency) || DEFAULT_FEE_CURRENCY;

  return {
    paymentRequired,
    active,
    amount,
    currency,
    paymentEnforced: paymentRequired && active && amount > 0,
  };
}

export async function saveCardRequestFeeConfig(input: {
  paymentRequired: boolean;
  active: boolean;
  amount: number;
  currency: string;
}) {
  const entries: [string, string][] = [
    [FEE_KEYS.paymentRequired, String(input.paymentRequired)],
    [FEE_KEYS.active, String(input.active)],
    [FEE_KEYS.amount, String(input.amount)],
    [FEE_KEYS.currency, input.currency],
  ];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}
