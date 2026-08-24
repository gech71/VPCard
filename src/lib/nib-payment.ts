import crypto from "crypto";
import { format } from "date-fns";

/**
 * NIBtera MiniApp payment integration, steps 3-5 of the integration guideline.
 *
 * Step 3 asks the bank for a payment token, signing the request so the bank can
 * check integrity. Step 4 happens in the browser (the token is posted to the
 * Super App over window.myJsChannel). Step 5 is the bank calling us back.
 */

export type PaymentEnv = {
  paymentUrl: string;
  accountNo: string;
  companyName: string;
  callbackUrl: string;
  paymentKey: string;
  /** Optional: "Check transaction status" endpoint, used to confirm a payment. */
  statusUrl?: string;
  /** Optional: token validation endpoint, reused from step 1/2. */
  validateUrl?: string;
};

export function readPaymentEnv(): PaymentEnv | null {
  // Trimmed because every one of these is signed verbatim: a trailing space or
  // stray CR in the .env file changes the hash and the bank rejects the call
  // with "Invalid data signature", giving no clue that whitespace is to blame.
  const env = (name: string) => (process.env[name] || "").trim();

  const paymentUrl = env("NIB_PAYMENT_URL");
  const accountNo = env("NIB_PAYMENT_ACCOUNT_NO");
  const companyName = env("NIB_PAYMENT_COMPANY_NAME");
  const paymentKey = env("NIB_PAYMENT_KEY");

  const callbackUrl =
    env("NIB_PAYMENT_CALLBACK_URL") ||
    (env("NEXT_PUBLIC_BASE_URL")
      ? `${env("NEXT_PUBLIC_BASE_URL")}/api/payments/callback`
      : "");

  if (
    !paymentUrl ||
    !accountNo ||
    !companyName ||
    !paymentKey ||
    !callbackUrl
  ) {
    // Named in the log so a 503 points straight at what is unset, without
    // leaking configuration to the Guest.
    const missing = [
      ["NIB_PAYMENT_URL", paymentUrl],
      ["NIB_PAYMENT_ACCOUNT_NO", accountNo],
      ["NIB_PAYMENT_COMPANY_NAME", companyName],
      ["NIB_PAYMENT_KEY", paymentKey],
      ["NIB_PAYMENT_CALLBACK_URL (or NEXT_PUBLIC_BASE_URL)", callbackUrl],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);

    console.error(
      `[nib-payment] payments are not configured; missing: ${missing.join(", ")}`,
    );

    return null;
  }

  return {
    paymentUrl,
    accountNo,
    companyName,
    callbackUrl,
    paymentKey,
    statusUrl: env("NIB_PAYMENT_STATUS_URL") || undefined,
    validateUrl: env("TOKEN_VALIDATION_ENDPOINT") || undefined,
  };
}

/**
 * Renders the amount exactly as the guideline's `String(amount)` does: 500
 * becomes "500", 99.5 becomes "99.5". No thousands separators, no forced
 * decimals, and never exponent notation - the signed text and the sent text
 * have to be byte-identical to what the bank re-derives.
 */
export function formatPaymentAmount(amount: number): string {
  // Deliberately the guideline's own expression, not a reformatting of it.
  return String(amount);
}

/**
 * The step 3 signature. Field order and capitalization are fixed by the
 * integration guideline - `callBackURL` and `Key` are cased exactly as shown -
 * and must not be re-sorted, because the bank rebuilds this exact string.
 */
export function buildPaymentSignature(input: {
  env: PaymentEnv;
  amount: string;
  token: string;
  transactionId: string;
  transactionTime: string;
}): string {
  const { env, amount, token, transactionId, transactionTime } = input;

  const signatureString = buildSignatureBase({
    env,
    amount,
    token,
    transactionId,
    transactionTime,
    key: env.paymentKey,
  });

  return crypto
    .createHash("sha256")
    .update(signatureString, "utf8")
    .digest("hex");
}

/**
 * The exact text that gets hashed. Split out so the failure path can log it
 * with the key redacted - when the bank says "Invalid data signature" the only
 * way to find the offending field is to compare this string against theirs.
 */
function buildSignatureBase(input: {
  env: PaymentEnv;
  amount: string;
  token: string;
  transactionId: string;
  transactionTime: string;
  key: string;
}): string {
  const { env, amount, token, transactionId, transactionTime, key } = input;

  return [
    `accountNo=${env.accountNo}`,
    `amount=${amount}`,
    `callBackURL=${env.callbackUrl}`,
    `companyName=${env.companyName}`,
    `Key=${key}`,
    `token=${token}`,
    `transactionId=${transactionId}`,
    `transactionTime=${transactionTime}`,
  ].join("&");
}

/** The signature base with the shared key masked, safe to log. */
export function redactedSignatureBase(input: {
  env: PaymentEnv;
  amount: string;
  token: string;
  transactionId: string;
  transactionTime: string;
}): string {
  return buildSignatureBase({ ...input, key: "<KEY>" });
}

export type InitiatePaymentResult =
  | {
      ok: true;
      paymentToken: string;
      transactionId: string;
      transactionTime: string;
      amount: string;
    }
  | {
      ok: false;
      error: string;
      /** HTTP status from the bank, when it answered at all. */
      status?: number;
      /** The bank's own words, for the server log. Never shown to the Guest. */
      detail?: string;
      /** The signed text with the key masked, for diagnosing a bad signature. */
      signatureBase?: string;
    };

/** Step 3: request a payment token for `amount` on behalf of the Guest. */
export async function requestPaymentToken(input: {
  env: PaymentEnv;
  amount: number;
  /** The MiniApp bearer token captured during step 1. */
  token: string;
}): Promise<InitiatePaymentResult> {
  const { env, token } = input;

  // The guideline signs and sends `String(amount)`, so 500 is "500" - NOT
  // "500.00". The bank rebuilds the signature over that exact text, so padding
  // the decimals here produces a different hash and "Invalid data signature."
  const amount = formatPaymentAmount(input.amount);
  const transactionId = crypto.randomUUID();
  const transactionTime = format(new Date(), "yyyyMMddHHmmss");

  const signature = buildPaymentSignature({
    env,
    amount,
    token,
    transactionId,
    transactionTime,
  });

  const payload = {
    accountNo: env.accountNo,
    amount,
    callBackURL: env.callbackUrl,
    companyName: env.companyName,
    token,
    transactionId,
    transactionTime,
    signature,
  };
  try {
    const response = await fetch(env.paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      // Read the body: a bare status code is not enough to tell an expired
      // token from a bad signature from a wrong account number.
      const detail = await response.text().catch(() => "");

      console.error(
        `[nib-payment] payment token request failed: ${response.status} ${response.statusText}`,
        {
          url: env.paymentUrl,
          accountNo: env.accountNo,
          companyName: env.companyName,
          callBackURL: env.callbackUrl,
          transactionId,
          transactionTime,
          amount,
          // Enough to spot a truncated or prefixed token without logging it.
          tokenLength: token.length,
          tokenPreview: `${token.slice(0, 6)}…${token.slice(-4)}`,
          response: detail.slice(0, 500),
          signatureBase: redactedSignatureBase({
            env,
            amount,
            token,
            transactionId,
            transactionTime,
          }),
        },
      );

      return {
        ok: false,
        error: `Payment service returned ${response.status}`,
        status: response.status,
        detail,
        signatureBase: redactedSignatureBase({
          env,
          amount,
          token,
          transactionId,
          transactionTime,
        }),
      };
    }

    const data = await response.json();
    const paymentToken = data?.token;

    if (!paymentToken || typeof paymentToken !== "string") {
      return {
        ok: false,
        error: "Payment service did not return a payment token",
      };
    }

    return { ok: true, paymentToken, transactionId, transactionTime, amount };
  } catch (err) {
    console.error("[nib-payment] could not reach the payment service", {
      url: env.paymentUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not reach the payment service" };
  }
}

/**
 * Confirms a transaction directly with the bank rather than trusting a caller.
 * Used to corroborate the step 5 callback and to resolve a payment that is
 * still pending when the Guest returns.
 *
 * Returns null when no status endpoint is configured or the bank cannot be
 * reached, which callers must treat as "still unknown", never as failure.
 */
export async function checkTransactionStatus(input: {
  env: PaymentEnv;
  reference: string;
  token?: string;
}): Promise<"SUCCESS" | "FAILED" | "PENDING" | null> {
  const { env, reference, token } = input;

  if (!env.statusUrl) return null;

  const base = env.statusUrl.endsWith("/")
    ? env.statusUrl
    : `${env.statusUrl}/`;

  try {
    const response = await fetch(`${base}${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = String(
      data?.status ?? data?.transactionStatus ?? data?.Status ?? "",
    ).toUpperCase();

    if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID", "000"].includes(raw)) {
      return "SUCCESS";
    }
    if (
      ["FAILED", "FAILURE", "DECLINED", "CANCELLED", "CANCELED"].includes(raw)
    ) {
      return "FAILED";
    }
    if (raw) return "PENDING";

    return null;
  } catch {
    return null;
  }
}

/**
 * Step 5 instructs us to validate the callback's Authorization token using the
 * same procedure as step 1. Returns the Guest phone number the bank associates
 * with the token, or null when the token is not valid.
 */
export async function validateMiniAppToken(
  authHeader: string,
  validateUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(validateUrl, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.phone ? String(data.phone) : null;
  } catch {
    return null;
  }
}

/**
 * The callback's token as the bank actually sends it.
 *
 * Observed in pre-production, the step 5 body carries the payment token as
 * `"{token: eyJhbGciOi...}"` - a stringified object literal, braces and label
 * included - rather than the bare JWT. Taking it verbatim makes every later
 * comparison fail, so the wrapper is peeled off here once. Also accepts a
 * `Bearer ` prefix, so the same helper serves the Authorization header.
 */
export function normalizeCallbackToken(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  let value = String(raw).trim();

  if (/^bearer\s+/i.test(value)) value = value.slice(value.indexOf(" ") + 1).trim();

  // "{token: eyJ...}" or "{"token":"eyJ..."}" - both seen from the bank.
  const wrapped = value.match(/^\{\s*["']?token["']?\s*:\s*["']?([^"'}\s]+)["']?\s*\}$/i);
  if (wrapped) value = wrapped[1];

  value = value.replace(/^["']|["']$/g, "").trim();

  return value || null;
}

/**
 * The claims of a JWT, without verifying its signature.
 *
 * The bank signs its tokens with a secret we do not hold, so this can never be
 * a trust decision on its own - it is only used to *match* a callback against a
 * payment we already created, alongside the stored token comparison.
 */
export function decodeTokenClaims(
  token: string | null | undefined,
): Record<string, unknown> | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

/** The token with its middle removed, safe to put in a log or an audit entry. */
export function redactToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 12) return "<token>";
  return `${token.slice(0, 8)}…${token.slice(-6)} (len ${token.length})`;
}
