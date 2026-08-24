import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

/**
 * One payment in full, with the audit trail that produced it.
 *
 * The trail is the point of this endpoint: a row that says FAILED is not much
 * use on its own, but the events behind it say whether the bank declined it,
 * whether a callback arrived and could not be authenticated, or whether it was
 * simply never confirmed.
 */

function idFrom(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can view payment history" },
        { status: 403 },
      );
    }

    const id = idFrom(request);

    const payment = await prisma.cardRequestPayment.findUnique({
      where: { id },
      select: {
        id: true,
        transactionId: true,
        txnRef: true,
        phoneNumber: true,
        amount: true,
        currency: true,
        status: true,
        paidAmount: true,
        paidByNumber: true,
        paidAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
        // The token itself never leaves the server; whether one was issued is
        // all an admin needs to tell "the bank never answered step 3" apart
        // from "the Guest never confirmed in the Super App".
        paymentToken: true,
        cardRequest: {
          select: {
            id: true,
            status: true,
            customerName: true,
            accountNumber: true,
            customerPhone: true,
            cardProgramName: true,
            createdAt: true,
            reviewedAt: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Events recorded against this payment, plus the ones written before the
    // row existed (a failed step 3 has no entity to point at, so it is matched
    // on the Guest's phone number within the payment's own lifetime).
    const events = await prisma.auditLog.findMany({
      where: {
        entityType: "PAYMENT",
        OR: [
          { entityId: payment.id },
          {
            entityId: null,
            actorEmail: payment.phoneNumber,
            createdAt: {
              gte: new Date(payment.createdAt.getTime() - 5 * 60 * 1000),
              lte: payment.updatedAt,
            },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        action: true,
        actorType: true,
        actorId: true,
        actorEmail: true,
        details: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    const { paymentToken, ...rest } = payment;

    return NextResponse.json({
      payment: {
        ...rest,
        amount: Number(payment.amount),
        hasPaymentToken: Boolean(paymentToken),
      },
      events,
    });
  } catch (error) {
    console.error("[admin-payments] detail failed", error);
    return NextResponse.json(
      { error: "Failed to load the payment" },
      { status: 500 },
    );
  }
}
