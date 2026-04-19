import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const createRequestSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  checkerId: z.string().uuid("Invalid checker ID"),
  notes: z.string().optional(),
});

// Create a new card request (Maker only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "MAKER") {
      return NextResponse.json(
        { error: "Only Makers can create card requests" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const validation = createRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const {
      accountNumber,
      customerName,
      customerEmail,
      customerPhone,
      checkerId,
      notes,
    } = validation.data;

    // Verify checker exists and has CHECKER role
    const checker = await prisma.user.findFirst({
      where: { id: checkerId, role: "CHECKER" },
    });

    if (!checker) {
      return NextResponse.json(
        { error: "Invalid checker selected" },
        { status: 400 },
      );
    }

    // Create the card request
    const cardRequest = await prisma.cardRequest.create({
      data: {
        accountNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        makerId: currentUser.userId,
        checkerId,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: "CREATE_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: { accountNumber, customerName, checkerId },
    });

    await createAuditLog({
      userId: currentUser.userId,
      action: "ASSIGN_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: { assignedTo: checker.email },
    });

    return NextResponse.json({
      success: true,
      request: cardRequest,
    });
  } catch (error) {
    console.error("Create request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Get card requests based on user role
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type"); // 'created' or 'assigned'

    let whereClause: Record<string, unknown> = {};

    if (currentUser.role === "MAKER") {
      if (type === "assigned") {
        // Makers don't have assigned requests
        whereClause = { makerId: "none" };
      } else {
        // Default: show requests created by this maker
        whereClause = { makerId: currentUser.userId };
      }
    } else if (currentUser.role === "CHECKER") {
      if (type === "created") {
        // Checkers don't create requests
        whereClause = { makerId: "none" };
      } else {
        // Default: show requests assigned to this checker
        whereClause = { checkerId: currentUser.userId };
      }
    }

    // Filter by status if provided
    if (status) {
      whereClause.status = status.toUpperCase();
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
    console.error("Get requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
