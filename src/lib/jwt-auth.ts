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
  exp?: number;
}

/**
 * Validates password complexity
 * Requirements:
 * - At least 10 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
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

  // Basic check for common weak patterns
  const weakPatterns = ["password", "admin123", "123456", "qwerty"];
  if (
    weakPatterns.some((pattern) => password.toLowerCase().includes(pattern))
  ) {
    return {
      isValid: false,
      error: "Password is too common or contains weak patterns",
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

    // Check if token is revoked
    const isRevoked = await prisma.revokedToken.findUnique({
      where: { token },
    });

    if (isRevoked) {
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

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes (PCI DSS 8.2.8)
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
