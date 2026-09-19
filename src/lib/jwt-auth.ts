import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import prisma from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET environment variable is missing or too weak (must be at least 32 characters)",
  );
}

if (!JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN environment variable is not set");
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: "SUPER_ADMIN" | "MAKER" | "CHECKER";
  /// The User.tokenVersion this token was signed against. verifyToken() rejects
  /// the token once the stored value moves past it, which is how a password
  /// change ends every session for the account rather than just the one that
  /// made the change.
  tokenVersion: number;
  exp?: number;
}

/**
 * Base words a password must not reduce to once case, digits and punctuation
 * are stripped.
 *
 * This is the check that catches the "Word@123" shape - Admin@123, Test@123,
 * Summer@2026. Those satisfy every composition rule while sitting near the top
 * of any credential-stuffing list, which is exactly the gap composition rules
 * leave open and why NIST SP 800-63B asks for a blocklist instead of more rules.
 */
const COMMON_BASE_WORDS = new Set([
  "password", "admin", "administrator", "test", "tester", "user", "username",
  "guest", "root", "login", "welcome", "letmein", "changeme", "default",
  "secret", "qwerty", "monkey", "dragon", "master", "shadow", "sunshine",
  "football", "baseball", "superman", "trustno", "iloveyou", "princess",
  "starwars", "whatever", "freedom", "computer", "internet",
  // Seasons and months: the other shape that meets complexity and still falls
  // to a dictionary in seconds.
  "spring", "summer", "autumn", "winter",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  // Terms specific to this deployment - an attacker targeting this bank tries
  // these first, and they are precisely what "CompanyName@123" is built from.
  "nib", "nibbank", "nibinternational", "vcard", "virtualcard", "prepaid",
  "bank", "banking", "ethiopia", "ethiopian", "addis", "addisababa",
]);

/** Weak enough to reject anywhere in the string, not only as the base word. */
const BANNED_SUBSTRINGS = [
  "password", "qwerty", "123456", "letmein", "nibbank", "adminadmin",
];

const KEYBOARD_ROWS = [
  "`1234567890-=",
  "qwertyuiop[]\\",
  "asdfghjkl;'",
  "zxcvbnm,./",
];

/** Letters only: "Admin@123" and "ADMIN-123" both reduce to "admin". */
function baseWord(password: string): string {
  return password.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Letters only, after undoing common character substitutions, so "P@ssw0rd"
 * reduces to "password". Deliberately separate from baseWord(): each catches a
 * shape the other misses, because the substitutions that rescue "P@ssw0rd"
 * would mangle "Admin@123" into something unrecognisable.
 */
const LEET_MAP: Record<string, string> = {
  "@": "a", "4": "a", "8": "b", "(": "c", "3": "e", "6": "g", "1": "i",
  "!": "i", "|": "i", "0": "o", "$": "s", "5": "s", "7": "t", "+": "t",
};

function leetNormalise(password: string): string {
  return password
    .toLowerCase()
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
}

/** A run of `minRun` repeated, sequential, or same-keyboard-row characters. */
function hasPredictableRun(password: string, minRun = 4): boolean {
  const lower = password.toLowerCase();

  if (new RegExp(`(.)\\1{${minRun - 1},}`).test(lower)) return true;

  const sources = ["abcdefghijklmnopqrstuvwxyz", "0123456789", ...KEYBOARD_ROWS];
  for (const source of sources) {
    const reversed = [...source].reverse().join("");
    for (const seq of [source, reversed]) {
      for (let i = 0; i + minRun <= seq.length; i++) {
        if (lower.includes(seq.slice(i, i + minRun))) return true;
      }
    }
  }

  return false;
}

/**
 * Validates password complexity
 * Requirements:
 * - At least 10 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - Not a common or predictable password (see COMMON_BASE_WORDS)
 */
export function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (password.length < 10) {
    return {
      isValid: false,
      error: "Password must be at least 10 characters long",
    };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return {
      isValid: false,
      error:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    };
  }

  // Checked against the raw string and the de-leeted one, so "P@ssw0rd12"
  // fails on the same term as "password12".
  const lower = password.toLowerCase();
  const deLeeted = leetNormalise(password);
  if (
    BANNED_SUBSTRINGS.some(
      (pattern) => lower.includes(pattern) || deLeeted.includes(pattern),
    )
  ) {
    return {
      isValid: false,
      error: "Password is too common or contains weak patterns",
    };
  }

  // The "Word@123" shape: strip the decoration and see what is actually left.
  if (
    COMMON_BASE_WORDS.has(baseWord(password)) ||
    COMMON_BASE_WORDS.has(leetNormalise(password))
  ) {
    return {
      isValid: false,
      error:
        "Password is based on a commonly guessed word. Adding numbers or symbols to a predictable word does not make it strong - try an unrelated passphrase instead.",
    };
  }

  if (hasPredictableRun(password)) {
    return {
      isValid: false,
      error:
        "Password contains a predictable sequence (such as 1234, abcd, qwerty, or a repeated character). Choose something less patterned.",
    };
  }

  return { isValid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Two independent kill switches, checked together to keep this to a single
    // round trip: revoked_tokens ends one specific session (logout), while
    // tokenVersion ends all of them at once (password change).
    const [isRevoked, user] = await Promise.all([
      prisma.revokedToken.findUnique({ where: { token } }),
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { tokenVersion: true },
      }),
    ]);

    if (isRevoked) {
      return null;
    }

    // Fail closed: an account that no longer exists, or a token predating this
    // field (signed before tokenVersion shipped, so the claim is undefined),
    // does not get the benefit of the doubt.
    if (!user || payload.tokenVersion !== user.tokenVersion) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Revokes a token by adding it to the revoked_tokens table.
 * This should be called on logout.
 */
export async function revokeToken(token: string): Promise<void> {
  try {
    const payload = jwt.decode(token) as JWTPayload;
    const expiresAt = payload?.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // Fallback to 24h if no exp

    await prisma.revokedToken.upsert({
      where: { token },
      update: {},
      create: {
        token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to revoke token:", error);
  }
}

export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("auth-token")?.value || null;
}

/**
 * How long the auth cookie should live, read off the token it will carry.
 *
 * Deriving this rather than hardcoding it is deliberate: the cookie maxAge and
 * the JWT's own exp used to be set independently, drifted apart (a 15 minute
 * cookie carrying a 1 hour token), and left the server enforcing four times the
 * session length the cookie advertised. Taking the number from the token means
 * they cannot disagree, whatever JWT_EXPIRES_IN is set to.
 */
export function cookieMaxAgeFor(token: string): number {
  const decoded = jwt.decode(token) as JWTPayload | null;
  if (!decoded?.exp) return 15 * 60;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: cookieMaxAgeFor(token), // PCI DSS 8.2.8, via JWT_EXPIRES_IN
    path: "/",
  });
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getAuthCookie();
  if (!token) return null;
  return await verifyToken(token);
}
