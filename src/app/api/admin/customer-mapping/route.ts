import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mappings = await prisma.customerIdMapping.findMany({
      orderBy: { nibCusId: "asc" },
      select: {
        id: true,
        nibCusId: true,
        pssCusId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      mappings,
      total: mappings.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load customer mappings." },
      { status: 500 },
    );
  }
}
