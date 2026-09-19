/**
 * Redaction for anything captured from a PSS API exchange.
 *
 * This runs on the way *into* the database, never on the way out to a screen.
 * A log table that holds live credentials is a credential store with weaker
 * controls than the real one: it gets dumped for support, copied into tickets,
 * and read by anyone with the Super Admin role. So the secret never lands.
 *
 * The rules err towards over-redaction. Losing a field from a troubleshooting
 * view costs an engineer one question; leaking a PAN or a live token from a
 * banking integration costs considerably more.
 */

/** What replaces a secret. Fixed width, so it never hints at the original. */
export const REDACTED = "********";

/**
 * Longest payload we keep, per side of the exchange. PSS responses are small;
 * anything past this is either an error page or an unexpected bulk response,
 * and neither is worth the storage.
 */
const MAX_PAYLOAD_CHARS = 20_000;

/**
 * Key fragments that mean the value is a credential. Matched against the
 * normalised key, so "client-secret", "client_secret" and "clientSecret" all
 * collapse to the same test.
 */
const SECRET_FRAGMENTS = [
  "password",
  "passwd",
  "passphrase",
  "secret",
  "token",
  "apikey",
  "authorization",
  "credential",
  "privatekey",
  "publickey",
  "encryptionkey",
  "signingkey",
  "sessionkey",
  "cookie",
  "signature",
  "hmac",
  "otp",
  "cvv",
  "cvc",
  "securitycode",
];

/**
 * Exact keys that are credentials but too short or too generic to match as a
 * fragment without catching innocent fields.
 */
const SECRET_KEYS = new Set([
  "auth",
  "key",
  "pin",
  "newpin",
  "oldpin",
  "currentpin",
  "confirmpin",
  "pinblock",
  "bearer",
  "jwt",
  "sessionid",
]);

/** Keys whose value is a card number: masked to the last four, not removed. */
const PAN_KEYS = new Set([
  "pan",
  "clearpan",
  "maskedpan",
  "cardnumber",
  "cardno",
  "primaryaccountnumber",
]);

/** Lowercase, and drop separators, so key styles converge. */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * "pin" is too short to match as a substring - it sits inside "shipping" - but
 * too important to match only exactly, since it arrives as cardPin, userPin and
 * pinBlock. Anchoring to either end catches the compounds without the noise.
 */
function isPinKey(k: string): boolean {
  return k === "pin" || k.startsWith("pin") || k.endsWith("pin");
}

function isSecretKey(key: string): boolean {
  const k = normaliseKey(key);
  if (SECRET_KEYS.has(k)) return true;
  if (isPinKey(k)) return true;
  return SECRET_FRAGMENTS.some((fragment) => k.includes(fragment));
}

function isPanKey(key: string): boolean {
  return PAN_KEYS.has(normaliseKey(key));
}

/** Luhn check, used to avoid masking ordinary long numbers that are not cards. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** `**** **** **** 1234` - enough for support to match a card, not to use one. */
export function maskPan(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return REDACTED;
  return `**** **** **** ${digits.slice(-4)}`;
}

/**
 * Catches secrets that arrive without a helpful key - a bare token in an array,
 * a PAN in a free-text field, a JWT concatenated into a message.
 */
function redactString(value: string): string {
  let out = value;

  // JSON Web Tokens, anywhere in the string.
  out = out.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, REDACTED);

  // "Authorization: Bearer xyz" and friends, in raw text bodies.
  out = out.replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`);

  // Card-number-shaped runs, only when they actually check out as a card.
  out = out.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    return passesLuhn(digits) ? maskPan(digits) : match;
  });

  return out;
}

/**
 * Walks a decoded payload and redacts by key and by value shape.
 *
 * `depth` guards against a pathological or cyclic structure taking the request
 * down with it - logging must never be the thing that breaks the call it is
 * observing.
 */
export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 12) return REDACTED;

  if (value === null || value === undefined) return value;

  if (typeof value === "string") return redactString(value);

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((entry) => redactPayload(entry, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      if (isPanKey(key)) {
        out[key] =
          typeof entry === "string" || typeof entry === "number"
            ? maskPan(String(entry))
            : REDACTED;
        continue;
      }
      out[key] = redactPayload(entry, depth + 1);
    }
    return out;
  }

  // Anything else (function, symbol, bigint) has no business in a payload.
  return REDACTED;
}

/**
 * Parses a body for storage: JSON where possible, redacted either way.
 *
 * A body that is not JSON is still worth keeping - PSS error pages and plain
 * text responses are often the most informative thing in a failed exchange - so
 * it is stored as a string under a marker key rather than discarded.
 */
export function redactBody(raw: string | null | undefined): unknown {
  if (!raw) return null;

  const truncated = raw.length > MAX_PAYLOAD_CHARS;
  const text = truncated ? raw.slice(0, MAX_PAYLOAD_CHARS) : raw;

  try {
    const parsed = JSON.parse(text);
    const redacted = redactPayload(parsed);
    if (truncated && redacted && typeof redacted === "object") {
      return { ...(redacted as object), __truncated: true };
    }
    return redacted;
  } catch {
    return {
      __raw: redactString(text),
      ...(truncated ? { __truncated: true } : {}),
    };
  }
}

/** Header names are the single most reliable place to find a live credential. */
export function redactHeaders(
  headers: Headers | Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!headers) return null;

  const entries: [string, string][] =
    headers instanceof Headers
      ? [...headers.entries()]
      : Object.entries(headers);

  if (entries.length === 0) return null;

  const out: Record<string, string> = {};
  for (const [name, value] of entries) {
    out[name] = isSecretKey(name) ? REDACTED : redactString(String(value));
  }
  return out;
}

/**
 * Strips credentials that were passed in the query string.
 *
 * Secrets in a URL are a known anti-pattern, which is exactly why they turn up:
 * the endpoint is the first thing an engineer reads off this screen, so it has
 * to be safe to read aloud.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let changed = false;
    parsed.searchParams.forEach((value, key) => {
      if (isSecretKey(key)) {
        parsed.searchParams.set(key, REDACTED);
        changed = true;
      }
    });
    // Credentials embedded as user:pass@host.
    if (parsed.username || parsed.password) {
      parsed.username = "";
      parsed.password = "";
      changed = true;
    }
    return changed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

/**
 * A readable service name taken from the endpoint path.
 *
 * PSS routes are shaped `/ServiceName/1.0`, so the version segment is dropped
 * and the segment before it used. Derived rather than passed in by callers,
 * which keeps every existing call site untouched.
 */
export function serviceNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const segments = pathname
      .split("/")
      .filter(Boolean)
      .filter((segment) => !/^v?\d+(\.\d+)*$/i.test(segment));
    const last = segments[segments.length - 1];
    if (!last) return "PSS";
    // "EcommerceActivation" -> "Ecommerce Activation"
    return last.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  } catch {
    return "PSS";
  }
}

/** Header and body fields the bank uses to tie an exchange to its own trace. */
const CORRELATION_HEADERS = [
  "x-correlation-id",
  "x-request-id",
  "x-trace-id",
  "correlationid",
  "requestid",
];

const CORRELATION_FIELDS = [
  "correlationid",
  "requestid",
  "transactionid",
  "traceid",
  "rrn",
  "reference",
  "referenceno",
  "referencenumber",
];

export function extractCorrelationId(
  headers: Record<string, string> | null,
  ...payloads: unknown[]
): string | null {
  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      if (CORRELATION_HEADERS.includes(name.toLowerCase()) && value) {
        return String(value).slice(0, 200);
      }
    }
  }

  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (
        CORRELATION_FIELDS.includes(normaliseKey(key)) &&
        (typeof value === "string" || typeof value === "number") &&
        String(value).length > 0
      ) {
        return String(value).slice(0, 200);
      }
    }
  }

  return null;
}
