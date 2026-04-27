import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

// Get all users with CHECKER role (for Maker to assign)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Makers and Super Admins can view checkers
    if (currentUser.role !== "MAKER" && currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const checkers = await prisma.user.findMany({
      where: { role: "CHECKER" },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      orderBy: { email: "asc" },
    });

    return NextResponse.json({ checkers });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
