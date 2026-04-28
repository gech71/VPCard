import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/server/email";

const resetPasswordRequestSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

// Super Admin triggers a password reset request for a user
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can initiate password resets" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const validation = resetPasswordRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { userId } = validation.data;

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await prisma.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        token: hashedToken,
        expiresAt,
      },
    });

    // Send email
    const emailSent = await sendPasswordResetEmail(targetUser.email, rawToken);

    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send reset email" },
        { status: 500 },
      );
    }

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: "REQUEST_PASSWORD_RESET",
      entityType: "USER",
      entityId: userId,
      details: { resetUserEmail: targetUser.email, initiatedBy: "SUPER_ADMIN" },
    });

    return NextResponse.json({
      success: true,
      message: "Password reset request sent successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Request password reset (generates token for self-service reset)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If the email exists, a reset link will be sent",
      });
    }

    // Generate reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    // Send email
    await sendPasswordResetEmail(user.email, rawToken);

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "REQUEST_PASSWORD_RESET",
      entityType: "USER",
      entityId: user.id,
      details: { resetUserEmail: user.email, initiatedBy: "SELF" },
    });

    return NextResponse.json({
      success: true,
      message: "If the email exists, a reset link will be sent",
    });
  } catch (error) {
    console.error("Self-service reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
