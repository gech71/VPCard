"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { sendPasswordResetEmail } from "@/lib/server/email";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

/**
 * How long to wait before a fresh reset link may be requested. Short enough that
 * a user whose email never arrived can simply try again, long enough to stop the
 * form being used to spam someone's inbox.
 */
const RESEND_COOLDOWN_MS = 60 * 1000;

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[a-zA-Z]/, "Must contain letters")
      .regex(/[0-9]/, "Must contain numbers"),
    confirmPassword: z.string().min(8, "Confirm password is required."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export async function requestPasswordResetAction(
  prevState: any,
  formData: FormData,
) {
  const validatedFields = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors.email?.[0] };
  }

  const { email } = validatedFields.data;

  // 1. Look up the account. A missing account returns the same response as a
  //    successful request, so the form cannot be used to discover which email
  //    addresses are registered.
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { success: true };
  }

  // 2. Throttle rather than lock out. Only a link issued in the last minute
  //    blocks a retry; anything older is simply superseded below, so a user
  //    whose email never arrived is not stuck waiting for it to expire.
  const recentToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      used: false,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
  });

  if (recentToken) {
    return {
      error:
        "A reset link was just sent. Please check your inbox, then try again in a minute if it has not arrived.",
    };
  }

  // 3. Revoke any older outstanding link — only the newest one should work.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // Set expiration to 1 hour from now
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Store hashed token in database
  const createdToken = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt,
    },
  });

  // 4. Send raw token via email. If delivery fails, revoke the token we just
  //    issued so a link that never arrived cannot block the next attempt.
  const emailSent = await sendPasswordResetEmail(user.email, rawToken);

  if (!emailSent) {
    await prisma.passwordResetToken.update({
      where: { id: createdToken.id },
      data: { used: true },
    });

    await createAuditLog({
      actorType: "USER",
      actorId: user.id,
      actorEmail: user.email,
      action: "REQUEST_PASSWORD_RESET",
      entityType: "AUTH",
      entityId: user.id,
      details: { event: "REQUEST_RESET", delivered: false },
    });

    return {
      error:
        "We could not send the reset email right now. Please try again shortly, or contact your administrator.",
    };
  }

  // Log action
  await createAuditLog({
    actorType: "USER",
    actorId: user.id,
    actorEmail: user.email,
    action: "REQUEST_PASSWORD_RESET",
    entityType: "AUTH",
    entityId: user.id,
    details: { event: "REQUEST_RESET", delivered: true },
  });

  return { success: true };
}

export async function resetPasswordAction(prevState: any, formData: FormData) {
  const validatedFields = ResetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { token: rawToken, password } = validatedFields.data;
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // Verify token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return { error: "Invalid or expired password reset token." };
  }

  // Generate new hashed password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update the password, consume this link, and revoke every other outstanding
  // link for the account — a link issued before the password changed must not
  // still work afterwards.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, used: false },
      data: { used: true },
    }),
  ]);

  // Log action
  await createAuditLog({
    actorType: "USER",
    actorId: resetToken.userId,
    actorEmail: resetToken.user.email,
    action: "RESET_PASSWORD",
    entityType: "AUTH",
    entityId: resetToken.userId,
    details: { event: "EXECUTE_RESET" },
  });

  return { success: true };
}

export async function validateResetToken(rawToken: string) {
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return false;
  }

  return true;
}
