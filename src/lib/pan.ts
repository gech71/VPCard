/**
 * How a card number is shown to a person.
 *
 * The first six digits and the last four are the most that may be displayed
 * under PCI DSS 3.3 - the first six identify the issuer and the last four let a
 * cardholder tell their own cards apart, while everything between stays hidden.
 */

/** Digits kept at the front: the issuer identification number. */
const LEADING = 6;

/** Digits kept at the end: what a cardholder recognises their card by. */
const TRAILING = 4;

/**
 * Masks a card number as `453212******3456`.
 *
 * Anything too short to mask meaningfully - fewer digits than the visible
 * portions themselves - is returned fully masked rather than exposed, because a
 * value that short is either not a PAN or is already truncated.
 */
export function maskPanForDisplay(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length <= LEADING + TRAILING) {
    return "*".repeat(digits.length);
  }

  return (
    digits.slice(0, LEADING) +
    "*".repeat(digits.length - LEADING - TRAILING) +
    digits.slice(-TRAILING)
  );
}

/**
 * Groups a rendered card number in fours, the way it is embossed on the card.
 *
 * Operates on characters rather than digits so a masked number groups the same
 * way an unmasked one does - `4532 12** **** 3456` sits in exactly the same
 * places as `4532 1234 5678 3456`, which is what stops the card face jumping
 * when the number is revealed.
 */
export function groupCardNumber(value: string): string {
  const compact = String(value ?? "").replace(/[\s-]/g, "");
  if (!compact) return "";

  return compact.replace(/(.{4})(?=.)/g, "$1 ").trim();
}

/** The last four digits alone, for labels and screen readers. */
export function lastFourDigits(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.slice(-TRAILING);
}
