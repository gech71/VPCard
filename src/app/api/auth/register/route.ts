import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, getCurrentUser, validatePassword } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string(), // Validation handled by custom function for better error messages
  role: z.enum(["MAKER", "CHECKER"]),
});

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is a Super Admin
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can register new users" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate input basic structure
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { email, password, role } = validation.data;

    // Perform deep password complexity validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: "REGISTER_USER",
      entityType: "USER",
      entityId: user.id,
      details: { registeredEmail: email, role },
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

// GET endpoint to list all users (Super Admin only)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can view users" },
        { status: 403 },
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
