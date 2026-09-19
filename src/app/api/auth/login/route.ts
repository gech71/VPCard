import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  setAuthCookie,
  removeAuthCookie,
} from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create audit log for failed attempt (non-existent user)
      await createAuditLog({
        actorType: "SYSTEM",
        action: "LOGIN_FAILED",
        entityType: "AUTH",
        details: { reason: "User not found", email },
      });

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockoutUntil.getTime() - new Date().getTime()) / (1000 * 60),
      );
      return NextResponse.json(
        {
          error: `Account is temporarily locked due to multiple failed attempts. Please try again in ${minutesLeft} minutes.`,
        },
        { status: 403 },
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      // Increment failed attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const MAX_ATTEMPTS = 5;
      let lockoutUntil = null;

      if (newFailedAttempts >= MAX_ATTEMPTS) {
        // Lock account for 30 minutes
        lockoutUntil = new Date(Date.now() + 30 * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockoutUntil,
        },
      });

      // Create audit log for failed attempt
      await createAuditLog({
        actorType: "USER",
        actorId: user.id,
        actorEmail: user.email,
        action: "LOGIN_FAILED",
        entityType: "AUTH",
        entityId: user.id,
        details: { reason: "Invalid password", attempt: newFailedAttempts },
      });

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Reset failed attempts, and bump tokenVersion to enforce a single active
    // session per account: every token signed against the previous value stops
    // verifying the moment this one is issued, so signing in here signs the
    // account out of any other browser or device it was left open on.
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        tokenVersion: { increment: 1 },
      },
    });

    // Generate JWT token — signed at the version the bump above just produced,
    // so this is the one session that survives.
    const token = generateToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      tokenVersion: updatedUser.tokenVersion,
    });

    // Set auth cookie
    await setAuthCookie(token);

    // Create audit log
    await createAuditLog({
      actorType: "USER",
      actorId: user.id,
      actorEmail: user.email,
      action: "LOGIN",
      entityType: "AUTH",
      entityId: user.id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
