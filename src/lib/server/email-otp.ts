import crypto from "crypto";

/**
 * The one-time code that proves a Guest controls the email address on their
 * card request.
 *
 * Policy lives here rather than in the routes so the send path and the verify
 * path cannot drift apart on how long a code lives or how many guesses it
 * survives.
 */

/** How long a freshly sent code stays usable. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Minimum gap between sends to one Guest, so Resend cannot be leaned on. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Wrong guesses a single code survives. Six digits is a million-wide space, so
 * the guess limit - not the code length - is what actually protects it.
 */
export const MAX_ATTEMPTS = 5;

/** Codes one Guest may be sent per window, so the endpoint cannot be used to mail-bomb an address. */
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_MS = 60 * 60 * 1000;

/**
 * How long a completed verification remains good for a submission. Long enough
 * to finish filling in the form, short enough that a stale proof cannot be
 * replayed days later.
 */
export const VERIFICATION_TTL_MS = 30 * 60 * 1000;

export const OTP_LENGTH = 6;

/**
 * The key the codes are HMAC'd with. Read lazily: a module-level throw would
 * take down the build rather than the one request that cannot be served.
 */
function otpKey(): string {
  const key =
    process.env.EMAIL_OTP_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ENCRYPTION_SECRET_KEY;

  if (!key) {
    throw new Error(
      "No secret available to key email verification codes. Set EMAIL_OTP_SECRET.",
    );
  }

  return key;
}

/**
 * A uniformly random six-digit code. `randomInt` is used rather than a modulo
 * of random bytes, which would bias the low digits.
 */
export function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

/**
 * Codes are stored as an HMAC over the code *and* who it was issued to, so a
 * row lifted from one Guest's verification cannot be replayed against another
 * address even if the same digits come up.
 */
export function hashOtp(input: {
  code: string;
  phoneNumber: string;
  email: string;
}): string {
  return crypto
    .createHmac("sha256", otpKey())
    .update(`${normaliseEmail(input.email)}:${input.phoneNumber}:${input.code}`)
    .digest("hex");
}

/** Compares two hex digests without leaking how far they matched. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  if (left.length !== right.length || left.length === 0) return false;

  return crypto.timingSafeEqual(left, right);
}

/**
 * The form an address is compared and stored in. Addresses are matched
 * case-insensitively so a Guest who verifies `Sam@example.com` and submits
 * `sam@example.com` is not sent round the loop again.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Six digits, nothing else - spaces and dashes people paste in are dropped. */
export function normaliseOtp(code: string): string {
  return code.replace(/\D/g, "");
}
