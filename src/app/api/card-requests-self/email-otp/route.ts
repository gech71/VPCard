import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sendCardRequestOtpEmail } from "@/lib/server/email";
import {
  MAX_SENDS_PER_WINDOW,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  SEND_WINDOW_MS,
  generateOtp,
  hashOtp,
  normaliseEmail,
} from "@/lib/server/email-otp";

/**
 * Sends a one-time code to the address a Guest wants on their card request.
 *
 * Only a Guest MiniApp session can call this: the phone number the token
 * resolved to is what the code is issued against, so one Guest can neither
 * verify on another's behalf nor use this endpoint to mail an arbitrary
 * address without a session of their own.
 */

const sendSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address"),
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
    const validation = sendSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const email = normaliseEmail(validation.data.email);
    const now = new Date();

    // Cooldown first: a Guest hammering Resend should be told to wait, not
    // have it counted against their hourly allowance.
    const lastSend = await prisma.emailVerification.findFirst({
      where: { phoneNumber },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (
      lastSend &&
      now.getTime() - lastSend.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      const retryAfterMs =
        RESEND_COOLDOWN_MS - (now.getTime() - lastSend.createdAt.getTime());

      return NextResponse.json(
        {
          error: `A code was just sent. Check your inbox, then try again in ${Math.ceil(
            retryAfterMs / 1000,
          )} seconds.`,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        },
        { status: 429 },
      );
    }

    // Counted per Guest rather than per address, so cycling through addresses
    // does not reset the allowance.
    const sendsInWindow = await prisma.emailVerification.count({
      where: {
        phoneNumber,
        createdAt: { gt: new Date(now.getTime() - SEND_WINDOW_MS) },
      },
    });

    if (sendsInWindow >= MAX_SENDS_PER_WINDOW) {
      await createAuditLog({
        actorType: "SYSTEM",
        actorId: "GUEST",
        actorEmail: phoneNumber,
        action: "EMAIL_OTP_THROTTLED",
        entityType: "CARD_REQUEST",
        details: { event: "EMAIL_OTP_THROTTLED", email, sendsInWindow },
      });

      return NextResponse.json(
        {
          error:
            "Too many verification codes have been requested. Please try again later.",
        },
        { status: 429 },
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    // Only the newest code should be live. Retiring the previous ones stops a
    // Guest with two codes in their inbox from having the older one work, and
    // stops the attempt counter being reset by simply asking for another.
    await prisma.emailVerification.updateMany({
      where: { phoneNumber, verifiedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    const verification = await prisma.emailVerification.create({
      data: {
        phoneNumber,
        email,
        codeHash: hashOtp({ code, phoneNumber, email }),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    const sent = await sendCardRequestOtpEmail(
      email,
      code,
      Math.round(OTP_TTL_MS / 60000),
    );

    if (!sent) {
      // A code nobody can receive is worse than none: retire it immediately so
      // the Guest is not held in the cooldown for a mail that never went out.
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { expiresAt: now },
      });

      await createAuditLog({
        actorType: "SYSTEM",
        actorId: "GUEST",
        actorEmail: phoneNumber,
        action: "EMAIL_OTP_SEND_FAILED",
        entityType: "CARD_REQUEST",
        details: { event: "EMAIL_OTP_SEND_FAILED", email },
      });

      return NextResponse.json(
        {
          error:
            "We could not send the verification code. Check the address and try again.",
        },
        { status: 502 },
      );
    }

    await createAuditLog({
      actorType: "SYSTEM",
      actorId: "GUEST",
      actorEmail: phoneNumber,
      action: "EMAIL_OTP_SENT",
      entityType: "CARD_REQUEST",
      details: { event: "EMAIL_OTP_SENT", email },
    });

    return NextResponse.json({
      sent: true,
      // The code itself is never returned - only when it dies and when the
      // Guest may ask for another.
      expiresAt: verification.expiresAt,
      resendAfterSeconds: Math.round(RESEND_COOLDOWN_MS / 1000),
    });
  } catch (error) {
    console.error("[email-otp] send failed", error);
    return NextResponse.json(
      { error: "Could not send the verification code" },
      { status: 500 },
    );
  }
}
