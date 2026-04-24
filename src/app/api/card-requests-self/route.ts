import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const selfRequestSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

// Create a self-initiated card request (any authenticated user)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if self card request is enabled
    const allowSelfCardRequest = await prisma.settings.findUnique({
      where: { key: "allowSelfCardRequest" },
    });

    if (!allowSelfCardRequest || allowSelfCardRequest.value !== "true") {
      return NextResponse.json(
        { error: "Self-initiated card requests are not enabled" },
        { status: 403 }
      );
    }

    // Get the default checker from settings
    const defaultCheckerSetting = await prisma.settings.findUnique({
      where: { key: "defaultCheckerId" },
    });

    if (!defaultCheckerSetting || !defaultCheckerSetting.value) {
      return NextResponse.json(
        { error: "No default checker configured. Please contact admin." },
        { status: 400 }
      );
    }

    const checkerId = defaultCheckerSetting.value;

    // Verify checker exists and has CHECKER role
    const checker = await prisma.user.findFirst({
      where: { id: checkerId, role: "CHECKER" },
    });

    if (!checker) {
      return NextResponse.json(
        { error: "Configured checker not found. Please contact admin." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const validation = selfRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      accountNumber,
      customerName,
      customerEmail,
      customerPhone,
      notes,
    } = validation.data;

    // Create the card request (user is both maker and requester)
    const cardRequest = await prisma.cardRequest.create({
      data: {
        accountNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes: notes ? `Self-request: ${notes}` : "Self-initiated card request",
        makerId: currentUser.userId,
        checkerId,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: "SELF_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: { accountNumber, customerName, checkerId, isSelfRequest: true },
    });

    await createAuditLog({
      userId: currentUser.userId,
      action: "ASSIGN_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: { assignedTo: checker.email, isSelfRequest: true },
    });

    return NextResponse.json({
      success: true,
      request: cardRequest,
      message: "Card request submitted successfully",
    });
  } catch (error) {
    console.error("Self request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}