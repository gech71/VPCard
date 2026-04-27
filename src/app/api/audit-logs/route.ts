import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

// Get audit logs (Super Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can view audit logs" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");

    const whereClause: Record<string, unknown> = {};

    if (action) {
      whereClause.action = action;
    }
    if (entityType) {
      whereClause.entityType = entityType;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: { email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
