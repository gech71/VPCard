/**
 * Shapes shared between the payment history API and the screens that read it,
 * plus the CSV column contract.
 *
 * Kept free of server imports so the client bundle can use the same types the
 * route hands out - one definition, so a renamed field breaks the build rather
 * than quietly rendering "undefined".
 */

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";

export type LinkedCardRequest = {
  id: string;
  status: string;
  customerName: string;
  accountNumber: string;
  createdAt: string;
};

export type AdminPayment = {
  id: string;
  /** Our originator id, sent to the bank in step 3. */
  transactionId: string;
  /** The bank's own reference, learned from the step 5 callback. */
  txnRef: string | null;
  phoneNumber: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  /** What the bank said was paid, as a string - it need not equal `amount`. */
  paidAmount: string | null;
  paidByNumber: string | null;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  cardRequest: LinkedCardRequest | null;
};

export type PaymentSummary = {
  counts: Record<PaymentStatus, number>;
  totals: Record<PaymentStatus, number>;
  /** Sum of everything that actually cleared. */
  collected: number;
  /** Paid, but no card request was ever submitted against it. */
  unspentCount: number;
  unspentTotal: number;
};

export type PaymentEvent = {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  actorEmail: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

export type PaymentDetail = Omit<AdminPayment, "cardRequest"> & {
  /** Whether the bank ever issued a payment token; the token itself is never
   *  sent to a browser. */
  hasPaymentToken: boolean;
  cardRequest:
    | (LinkedCardRequest & {
        customerPhone: string | null;
        cardProgramName: string | null;
        reviewedAt: string | null;
      })
    | null;
};

export const PAYMENT_CSV_HEADERS = [
  "Started",
  "Paid at",
  "Status",
  "Guest phone",
  "Paid by",
  "Amount",
  "Currency",
  "Bank reported amount",
  "Our transaction id",
  "Bank reference",
  "Failure reason",
  "Card request",
  "Card request status",
  "Account number",
] as const;

/** One CSV row, in the same order as PAYMENT_CSV_HEADERS. */
export function toPaymentCsvRow(payment: AdminPayment): (string | number)[] {
  return [
    new Date(payment.createdAt).toLocaleString(),
    payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "",
    payment.status,
    payment.phoneNumber,
    payment.paidByNumber ?? "",
    payment.amount.toFixed(2),
    payment.currency,
    payment.paidAmount ?? "",
    payment.transactionId,
    payment.txnRef ?? "",
    payment.failureReason ?? "",
    payment.cardRequest?.customerName ?? "",
    payment.cardRequest?.status ?? "",
    payment.cardRequest?.accountNumber ?? "",
  ];
}
