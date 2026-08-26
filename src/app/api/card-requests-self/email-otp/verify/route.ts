import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  MAX_ATTEMPTS,
  OTP_LENGTH,
  hashOtp,
  hashesMatch,
  normaliseEmail,
  normaliseOtp,
} from "@/lib/server/email-otp";

/**
 * Checks the code a Guest typed against the one that was mailed to them.
 *
 * Every wrong guess is counted against the code itself, not the session, so
 * the attempt limit cannot be sidestepped by reconnecting - and cannot be
 * reset by asking for a new code either, since sending one retires the old.
 */

const verifySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address"),
  code: z.string().trim().min(1, "Enter the code from your email"),
});

export async function POST(request: NextRequest) {
  try {
    const phoneNumber = await getDecryptedPhoneFromCookie();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Your session has expired. Please reopen the card request." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const email = normaliseEmail(validation.data.email);
    const code = normaliseOtp(validation.data.code);

    if (code.length !== OTP_LENGTH) {
      return NextResponse.json(
        { error: `Enter the ${OTP_LENGTH}-digit code from your email.` },
        { status: 400 },
      );
    }

    const now = new Date();

    const verification = await prisma.emailVerification.findFirst({
      where: {
        phoneNumber,
        email,
        verifiedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    // Deliberately the same answer whether no code was ever sent, it expired,
    // or it was for a different address: none of those should tell a caller
    // anything about what other addresses have been challenged.
    if (!verification) {
      return NextResponse.json(
        {
          error:
            "That code has expired or is no longer valid. Send a new one and try again.",
        },
        { status: 400 },
      );
    }

    if (verification.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          error: "Too many incorrect attempts. Send a new code to try again.",
        },
        { status: 429 },
      );
    }

    const matches = hashesMatch(
      verification.codeHash,
      hashOtp({ code, phoneNumber, email }),
    );

    if (!matches) {
      // Recorded before answering, so a caller cannot outrun the counter by
      // abandoning the connection.
      const updated = await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });

      const remaining = Math.max(0, MAX_ATTEMPTS - updated.attempts);

      return NextResponse.json(
        {
          error: remaining
            ? `That code is not correct. ${remaining} attempt${
                remaining === 1 ? "" : "s"
              } remaining.`
            : "Too many incorrect attempts. Send a new code to try again.",
          attemptsRemaining: remaining,
        },
        { status: 400 },
      );
    }

    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verifiedAt: now, attempts: { increment: 1 } },
    });

    await createAuditLog({
      actorType: "SYSTEM",
      actorId: "GUEST",
      actorEmail: phoneNumber,
      action: "EMAIL_OTP_VERIFIED",
      entityType: "CARD_REQUEST",
      details: { event: "EMAIL_OTP_VERIFIED", email },
    });

    return NextResponse.json({ verified: true, email });
  } catch (error) {
    console.error("[email-otp] verify failed", error);
    return NextResponse.json(
      { error: "Could not verify the code" },
      { status: 500 },
    );
  }
}
