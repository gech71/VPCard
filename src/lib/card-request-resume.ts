/**
 * Remembers a Guest's place in the card-request flow across the WebView reload
 * the NIBtera Super App performs when its payment sheet closes.
 *
 * That reload throws away all in-memory React state and lands the Guest back on
 * the dashboard, so without this they had to press "Request a card" and agree to
 * the terms a second time before reaching the form they had just paid for.
 *
 * Only the account and the terms version they agreed to are kept - never
 * anything about the payment itself. Whether a payment exists is always asked of
 * the server; this marker only says "this device was mid-request for this
 * account and had agreed to this version".
 *
 * Browser storage can be missing or throw (private mode, cleared site data), so
 * every access is guarded and the flow simply falls back to the normal steps.
 */

const STORAGE_KEY = "vpcard.cardRequestResume";

/** Long enough to cover a slow payment, short enough not to linger. */
const MAX_AGE_MS = 60 * 60 * 1000;

export type CardRequestResume = {
  accountNumber: string;
  /** The terms version agreed to before paying; null when none was published. */
  termsVersionId: string | null;
  savedAt: number;
};

export function saveCardRequestResume(
  marker: Omit<CardRequestResume, "savedAt">,
): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...marker, savedAt: Date.now() }),
    );
  } catch {
    /* storage unavailable - the Guest just walks the steps again */
  }
}

export function readCardRequestResume(): CardRequestResume | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CardRequestResume>;

    if (
      typeof parsed.accountNumber !== "string" ||
      !parsed.accountNumber ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      accountNumber: parsed.accountNumber,
      termsVersionId:
        typeof parsed.termsVersionId === "string" ? parsed.termsVersionId : null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearCardRequestResume(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
