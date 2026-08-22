"use server";

import crypto from "crypto";

import prisma from "@/lib/prisma";
import {
  generateToken,
  getAuthCookie,
  setAuthCookie,
  revokeToken,
  verifyToken,
} from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { sendEmailChangeNoticeEmail } from "@/lib/server/email";

/**
 * Every way an email-change link can be received. The verify page renders one
 * message per state, so a user always learns *why* a link did not work rather
 * than getting a single catch-all failure.
 */
export type EmailChangeTokenState =
  | { status: "VALID"; newEmail: string; currentEmail: string }
  | { status: "INVALID" }
  | { status: "EXPIRED"; newEmail: string }
  | { status: "USED"; newEmail: string }
  | { status: "CONFLICT"; newEmail: string };

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Inspects a link without consuming it, so the verify page can show what is
 * about to happen and let the user confirm deliberately. Confirming is a
 * separate POST - opening the link never changes the account on its own.
 */
export async function inspectEmailChangeToken(
  rawToken: string,
): Promise<EmailChangeTokenState> {
  if (!rawToken) {
    return { status: "INVALID" };
  }

  const changeToken = await prisma.emailChangeToken.findUnique({
    where: { token: hashToken(rawToken) },
    include: { user: true },
  });

  if (!changeToken) {
    return { status: "INVALID" };
  }

  if (changeToken.used) {
    return { status: "USED", newEmail: changeToken.newEmail };
  }

  if (changeToken.expiresAt < new Date()) {
    return { status: "EXPIRED", newEmail: changeToken.newEmail };
  }

  // The address may have been claimed by someone else between the request and
  // the click, so re-check rather than trusting the state at request time.
  const taken = await prisma.user.findFirst({
    where: {
      email: { equals: changeToken.newEmail, mode: "insensitive" },
      NOT: { id: changeToken.userId },
    },
    select: { id: true },
  });

  if (taken) {
    return { status: "CONFLICT", newEmail: changeToken.newEmail };
  }

  return {
    status: "VALID",
    newEmail: changeToken.newEmail,
    currentEmail: changeToken.user.email,
  };
}

type ConfirmEmailChangeState = {
  success?: boolean;
  newEmail?: string;
  /** True when this browser's session was re-issued against the new address. */
  sessionRefreshed?: boolean;
  error?: string;
} | null;

/**
 * Applies a verified email change. Deliberately unauthenticated: the link is
 * the proof of ownership, and it may well be opened on the phone the new
 * mailbox lives on rather than in the signed-in browser.
 */
export async function confirmEmailChangeAction(
  prevState: ConfirmEmailChangeState,
  formData: FormData,
): Promise<ConfirmEmailChangeState> {
  const rawToken = String(formData.get("token") || "");

  if (!rawToken) {
    return { error: "This verification link is invalid." };
  }

  const changeToken = await prisma.emailChangeToken.findUnique({
    where: { token: hashToken(rawToken) },
    include: { user: true },
  });

  if (!changeToken) {
    return { error: "This verification link is invalid." };
  }

  if (changeToken.used) {
    return {
      error:
        "This verification link has already been used. Request a new one if the address still needs changing.",
    };
  }

  if (changeToken.expiresAt < new Date()) {
    return {
      error:
        "This verification link has expired. Request a new one from Settings.",
    };
  }

  const previousEmail = changeToken.user.email;
  const { newEmail } = changeToken;

  const taken = await prisma.user.findFirst({
    where: {
      email: { equals: newEmail, mode: "insensitive" },
      NOT: { id: changeToken.userId },
    },
    select: { id: true },
  });

  if (taken) {
    return {
      error:
        "That email address is now registered to another user, so it can no longer be used.",
    };
  }

  // Move the address and retire every outstanding link for the account in one
  // transaction - a link issued against the old address must not survive the
  // change that supersedes it.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: changeToken.userId },
      data: { email: newEmail },
    }),
    prisma.emailChangeToken.updateMany({
      where: { userId: changeToken.userId, used: false },
      data: { used: true },
    }),
  ]);

  // If this same browser is signed in as the account that just moved, re-issue
  // the session so the JWT's email claim (used for audit attribution) matches
  // the new address. Confirming from anywhere else simply leaves that session
  // to lapse on its own inactivity timeout.
  // Guarded: the address has already been committed above, so a cookie store
  // that refuses to co-operate must not surface as a failed email change.
  let sessionRefreshed = false;

  try {
    const authToken = await getAuthCookie();

    if (authToken) {
      const payload = await verifyToken(authToken);

      if (payload && payload.userId === changeToken.userId) {
        await revokeToken(authToken);
        await setAuthCookie(
          generateToken({
            userId: payload.userId,
            email: newEmail,
            role: payload.role,
          }),
        );
        sessionRefreshed = true;
      }
    }
  } catch {
    sessionRefreshed = false;
  }

  await createAuditLog({
    actorType: "ADMIN",
    actorId: changeToken.userId,
    actorEmail: newEmail,
    targetUserId: changeToken.userId,
    action: "CHANGE_EMAIL",
    entityType: "AUTH",
    entityId: changeToken.userId,
    details: { event: "CHANGE_EMAIL", previousEmail, newEmail },
  });

  // Best effort only - the change is already verified and committed, so a
  // failed courtesy notice must not report the change as failed.
  await sendEmailChangeNoticeEmail(previousEmail, newEmail);

  return { success: true, newEmail, sessionRefreshed };
}
