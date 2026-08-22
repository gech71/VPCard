import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getCurrentUser, type JWTPayload } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { sendEmailChangeVerificationEmail } from "@/lib/server/email";

const requestEmailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .min(1, "New email address is required")
    .email("Please enter a valid email address"),
});

/**
 * How long a verification link stays live, and how long before another one may
 * be requested. Both mirror the password-reset flow so the two behave alike.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Discriminated on `error` so that `if (error) return error;` narrows
 * `currentUser` to a definite value in every caller below.
 */
type SuperAdminGuard =
  | { currentUser: JWTPayload; error?: undefined }
  | { currentUser?: undefined; error: NextResponse };

async function requireSuperAdmin(): Promise<SuperAdminGuard> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only Super Admin can use account security settings" },
        { status: 403 },
      ),
    };
  }

  return { currentUser };
}

/** Current account email plus any verification still outstanding. */
export async function GET() {
  try {
    const { currentUser, error } = await requireSuperAdmin();
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const pending = await prisma.emailChangeToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { newEmail: true, expiresAt: true, createdAt: true },
    });

    return NextResponse.json({
      email: user.email,
      role: user.role,
      pendingChange: pending
        ? {
            newEmail: pending.newEmail,
            expiresAt: pending.expiresAt,
            requestedAt: pending.createdAt,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load account details" },
      { status: 500 },
    );
  }
}

/**
 * Starts an email change: issues a verification token and mails it to the new
 * address. Nothing on the account changes here - the address only moves when
 * that link is confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    const { currentUser, error } = await requireSuperAdmin();
    if (error) return error;

    const body = await request.json();
    const validation = requestEmailChangeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { newEmail } = validation.data;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "That is already your current email address" },
        { status: 400 },
      );
    }

    // Compare case-insensitively so a differently-cased variant of an existing
    // address cannot slip past the unique index and create a second account
    // that logs in under what looks like the same email.
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: newEmail, mode: "insensitive" },
        NOT: { id: user.id },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "That email address is already registered to another user" },
        { status: 409 },
      );
    }

    // Throttle repeat sends without locking the flow: only a link issued in the
    // last minute blocks a retry, anything older is superseded below.
    const recentToken = await prisma.emailChangeToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      },
    });

    if (recentToken) {
      return NextResponse.json(
        {
          error:
            "A verification link was just sent. Check that inbox, then try again in a minute if it has not arrived.",
        },
        { status: 429 },
      );
    }

    // Only the newest request should be live - retire any earlier ones so an
    // abandoned address cannot still be confirmed later.
    await prisma.emailChangeToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    const createdToken = await prisma.emailChangeToken.create({
      data: {
        userId: user.id,
        newEmail,
        token: hashedToken,
        expiresAt,
      },
    });

    const emailSent = await sendEmailChangeVerificationEmail(
      newEmail,
      rawToken,
      user.email,
    );

    if (!emailSent) {
      // Retire a link that never arrived so it cannot block the next attempt.
      await prisma.emailChangeToken.update({
        where: { id: createdToken.id },
        data: { used: true },
      });

      await createAuditLog({
        actorType: "ADMIN",
        actorId: user.id,
        actorEmail: user.email,
        targetUserId: user.id,
        action: "REQUEST_EMAIL_CHANGE",
        entityType: "AUTH",
        entityId: user.id,
        details: { event: "REQUEST_EMAIL_CHANGE", newEmail, delivered: false },
      });

      return NextResponse.json(
        {
          error:
            "We could not send the verification email right now. Please check the address and try again shortly.",
        },
        { status: 502 },
      );
    }

    await createAuditLog({
      actorType: "ADMIN",
      actorId: user.id,
      actorEmail: user.email,
      targetUserId: user.id,
      action: "REQUEST_EMAIL_CHANGE",
      entityType: "AUTH",
      entityId: user.id,
      details: { event: "REQUEST_EMAIL_CHANGE", newEmail, delivered: true },
    });

    return NextResponse.json({
      success: true,
      message: `Verification link sent to ${newEmail}`,
      pendingChange: {
        newEmail,
        expiresAt,
        requestedAt: createdToken.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** Abandons an outstanding email change without waiting for it to expire. */
export async function DELETE() {
  try {
    const { currentUser, error } = await requireSuperAdmin();
    if (error) return error;

    const result = await prisma.emailChangeToken.updateMany({
      where: { userId: currentUser.userId, used: false },
      data: { used: true },
    });

    if (result.count > 0) {
      await createAuditLog({
        actorType: "ADMIN",
        actorId: currentUser.userId,
        actorEmail: currentUser.email,
        targetUserId: currentUser.userId,
        action: "REQUEST_EMAIL_CHANGE",
        entityType: "AUTH",
        entityId: currentUser.userId,
        details: { event: "CANCEL_EMAIL_CHANGE", cancelled: result.count },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Pending email change cancelled",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
