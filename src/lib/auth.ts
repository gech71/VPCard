import * as crypto from "crypto";
import { cookies } from "next/headers";

const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
export const COOKIE_NAME = "user-phone";
/**
 * The MiniApp bearer token from step 1, kept because step 3 has to send it
 * back to the bank when asking for a payment token. Encrypted at rest and
 * httpOnly, exactly like the phone number it arrives with.
 */
export const TOKEN_COOKIE_NAME = "miniapp-token";
const ALGORITHM = "aes-256-gcm";

if (!ENCRYPTION_SECRET_KEY) {
  throw new Error("ENCRYPTION_SECRET_KEY must be set in .env");
}

// Derive a consistent 32-byte key from the secret using SHA-256
const KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET_KEY).digest();

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  // Return iv:tag:encrypted to store the unique IV and Auth Tag with the ciphertext
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(":")) {
    return "";
  }

  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      // Handle legacy format or invalid format
      return "";
    }

    const [ivHex, tagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    return "";
  }
}

export async function setEncryptedPhoneCookie(phoneNumber: string) {
  const encryptedPhone = encrypt(phoneNumber);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encryptedPhone, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  });
}

export async function setAccountsCookie(accounts: any[]) {
  const cookieStore = await cookies();
  cookieStore.set("user-accounts", JSON.stringify(accounts), {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  });
}

export async function getAccountsFromCookie(): Promise<any[] | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("user-accounts");
  if (!cookie?.value) return null;
  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", { maxAge: 0 });
  cookieStore.set("user-accounts", "", { maxAge: 0 });
  cookieStore.set(TOKEN_COOKIE_NAME, "", { maxAge: 0 });
}

/** The Guest MiniApp token, for the payment steps. Null when not present. */
export async function getDecryptedMiniAppToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(TOKEN_COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const raw = decrypt(cookie.value);
    if (!raw) return null;

    // Defensive: an earlier build stored the header verbatim, prefix and all.
    // Stripping it here means a cookie written by that build heals itself
    // instead of sending "Bearer Bearer <token>" and drawing a 401.
    return raw.replace(/^Bearer\s+/i, "").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Drops the stored MiniApp token. Called when the bank rejects it, so the next
 * page load captures a fresh one rather than retrying a token we know is bad.
 */
export async function clearMiniAppTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

export async function getDecryptedPhoneFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }

  try {
    const decryptedPhone = decrypt(cookie.value);
    if (!decryptedPhone) {
      // This means decryption failed. Clear the invalid cookies.
      await clearAuthCookies();
      return null;
    }
    return decryptedPhone;
  } catch (error) {
    // Clear the corrupted cookies
    await clearAuthCookies();
    return null;
  }
}
