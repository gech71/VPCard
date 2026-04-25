import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Extract filters
    const status = searchParams.get("status");
    const accountNumber = searchParams.get("accountNumber");
    const customerName = searchParams.get("customerName");
    const customerPhone = searchParams.get("customerPhone");
    const customerEmail = searchParams.get("customerEmail");
    const checkerId = searchParams.get("checkerId");
    const pan = searchParams.get("pan");
    const cvv = searchParams.get("cvv");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    let whereClause: any = {};

    if (status) {
      whereClause.status = status.toUpperCase();
    }
    
    if (accountNumber) {
      whereClause.accountNumber = { contains: accountNumber, mode: 'insensitive' };
    }
    
    if (customerName) {
      whereClause.customerName = { contains: customerName, mode: 'insensitive' };
    }
    
    if (customerPhone) {
      whereClause.customerPhone = { contains: customerPhone, mode: 'insensitive' };
    }
    
    if (customerEmail) {
      whereClause.customerEmail = { contains: customerEmail, mode: 'insensitive' };
    }
    
    if (checkerId \u0026\u0026 checkerId !== "all") {
      whereClause.checkerId = checkerId;
    }
    
    if (pan) {
      whereClause.pan = { contains: pan, mode: 'insensitive' };
    }
    
    if (cvv) {
      whereClause.cvv = { contains: cvv, mode: 'insensitive' };
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const requests = await prisma.cardRequest.findMany({
      where: whereClause,
      include: {
        maker: {
          select: { email: true, role: true },
        },
        checker: {
          select: { email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Admin get requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
