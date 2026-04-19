import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const reviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z.string().optional(),
});

// Approve or Reject a card request (Checker only)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "CHECKER") {
      return NextResponse.json(
        { error: "Only Checkers can review requests" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("id");

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validation = reviewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { action, reviewNotes } = validation.data;

    // Find the card request
    const cardRequest = await prisma.cardRequest.findUnique({
      where: { id: requestId },
    });

    if (!cardRequest) {
      return NextResponse.json(
        { error: "Card request not found" },
        { status: 404 },
      );
    }

    // Verify this request is assigned to this checker
    if (cardRequest.checkerId !== currentUser.userId) {
      return NextResponse.json(
        { error: "This request is not assigned to you" },
        { status: 403 },
      );
    }

    // Verify the request is still pending
    if (cardRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "This request has already been reviewed" },
        { status: 400 },
      );
    }

    // Update the request
    const updatedRequest = await prisma.cardRequest.update({
      where: { id: requestId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedBy: currentUser.userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    // Create audit log
    const auditAction =
      action === "APPROVE" ? "APPROVE_REQUEST" : "REJECT_REQUEST";
    await createAuditLog({
      userId: currentUser.userId,
      action: auditAction,
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: {
        accountNumber: cardRequest.accountNumber,
        customerName: cardRequest.customerName,
        reviewNotes,
      },
    });

    // If approved, simulate sending to external system (PSS endpoint)
    if (action === "APPROVE") {
      // In production, call the PSS endpoint here
      console.log(
        `[SIMULATION] Sending card request ${cardRequest.id} to PSS system`,
      );
      console.log(
        `Account: ${cardRequest.accountNumber}, Customer: ${cardRequest.customerName}`,
      );
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Review request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Get a specific card request by ID
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("id");

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 },
      );
    }

    const cardRequest = await prisma.cardRequest.findUnique({
      where: { id: requestId },
      include: {
        maker: {
          select: { email: true, role: true },
        },
        checker: {
          select: { email: true, role: true },
        },
      },
    });

    if (!cardRequest) {
      return NextResponse.json(
        { error: "Card request not found" },
        { status: 404 },
      );
    }

    // RBAC: Check if user has access to this request
    const hasAccess =
      currentUser.role === "SUPER_ADMIN" ||
      cardRequest.makerId === currentUser.userId ||
      cardRequest.checkerId === currentUser.userId;

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create audit log for viewing
    await createAuditLog({
      userId: currentUser.userId,
      action: "VIEW_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
    });

    return NextResponse.json({ request: cardRequest });
  } catch (error) {
    console.error("Get request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
