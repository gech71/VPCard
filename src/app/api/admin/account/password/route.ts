import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import {
  getCurrentUser,
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";

const changePasswordSchema = z
  .object({
    // Complexity is checked by validatePassword() so the caller gets the same
    // wording as registration; zod only guards shape here.
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(1, "New password is required"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

/** Changes the signed-in Super Admin's own password. */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can use account security settings" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = validation.data;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // 1. Prove the person at the keyboard knows the existing password before
    //    anything else - a live session alone is not enough to rotate it.
    const currentPasswordValid = await verifyPassword(
      currentPassword,
      user.password,
    );

    if (!currentPasswordValid) {
      await createAuditLog({
        actorType: "ADMIN",
        actorId: user.id,
        actorEmail: user.email,
        targetUserId: user.id,
        action: "CHANGE_PASSWORD",
        entityType: "AUTH",
        entityId: user.id,
        details: { event: "CHANGE_PASSWORD", outcome: "WRONG_CURRENT_PASSWORD" },
      });

      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    // 2. Apply the same complexity policy registration uses.
    const passwordValidation = validatePassword(newPassword);

    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 },
      );
    }

    // 3. Reject a no-op rotation - reusing the same secret is not a change.
    const isSamePassword = await verifyPassword(newPassword, user.password);

    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password" },
        { status: 400 },
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    // Rotate the password and burn any outstanding reset links in one go - a
    // link issued before the change must not still work afterwards. This
    // mirrors resetPasswordAction().
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      }),
    ]);

    await createAuditLog({
      actorType: "ADMIN",
      actorId: user.id,
      actorEmail: user.email,
      targetUserId: user.id,
      action: "CHANGE_PASSWORD",
      entityType: "AUTH",
      entityId: user.id,
      details: { event: "CHANGE_PASSWORD", outcome: "SUCCESS" },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
