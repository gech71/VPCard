import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currencies = await prisma.currency.findMany({
      orderBy: { curIde: "asc" },
      select: {
        id: true,
        curIde: true,
        curLabel: true,
        curAlphaCode: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ currencies, count: currencies.length });
  } catch {
    return NextResponse.json(
      { error: "Failed to load currencies." },
      { status: 500 },
    );
  }
}
