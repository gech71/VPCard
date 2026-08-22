import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getDecryptedPhoneFromCookie, getDecryptedMiniAppToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  checkTransactionStatus,
  readPaymentEnv,
} from "@/lib/nib-payment";

/**
 * Polled by the Guest's payment screen after step 4 hands the payment token to
 * the Super App.
 *
 * A payment that is still PENDING is chased up with the bank's "check
 * transaction status" endpoint, so a callback that never arrives does not leave
 * a Guest stuck on a spinner having already paid.
 */
export async function GET(request: NextRequest) {
  try {
    const phoneNumber = await getDecryptedPhoneFromCookie();

    if (!phoneNumber) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const transactionId = request.nextUrl.searchParams.get("transactionId");

    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required" },
        { status: 400 },
      );
    }

    const payment = await prisma.cardRequestPayment.findUnique({
      where: { transactionId },
      include: { cardRequest: { select: { id: true } } },
    });

    // Scoped to the caller so one Guest cannot poll another's payment.
    if (!payment || payment.phoneNumber !== phoneNumber) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "PENDING") {
      const env = readPaymentEnv();

      if (env?.statusUrl) {
        const token = await getDecryptedMiniAppToken();
        const remote = await checkTransactionStatus({
          env,
          reference: payment.txnRef || payment.transactionId,
          token: token ?? undefined,
        });

        if (remote === "SUCCESS") {
          const updated = await prisma.cardRequestPayment.update({
            where: { id: payment.id },
            data: { status: "SUCCESS", paidAt: payment.paidAt ?? new Date() },
          });

          await createAuditLog({
            actorType: "SYSTEM",
            actorId: "GUEST",
            actorEmail: phoneNumber,
            action: "PAYMENT_CONFIRMED",
            entityType: "PAYMENT",
            entityId: payment.id,
            details: {
              event: "PAYMENT_CONFIRMED",
              via: "STATUS_CHECK",
              transactionId,
            },
          });

          return NextResponse.json({
            status: updated.status,
            transactionId,
            amount: Number(updated.amount),
            currency: updated.currency,
            consumed: false,
          });
        }

        if (remote === "FAILED") {
          const updated = await prisma.cardRequestPayment.update({
            where: { id: payment.id },
            data: { status: "FAILED", failureReason: "Declined by the bank" },
          });

          await createAuditLog({
            actorType: "SYSTEM",
            actorId: "GUEST",
            actorEmail: phoneNumber,
            action: "PAYMENT_FAILED",
            entityType: "PAYMENT",
            entityId: payment.id,
            details: { event: "PAYMENT_FAILED", via: "STATUS_CHECK", transactionId },
          });

          return NextResponse.json({
            status: updated.status,
            transactionId,
            amount: Number(updated.amount),
            currency: updated.currency,
            consumed: false,
          });
        }
      }
    }

    return NextResponse.json({
      status: payment.status,
      transactionId,
      amount: Number(payment.amount),
      currency: payment.currency,
      // True once spent on a card request; the Guest would need to pay again.
      consumed: payment.cardRequest !== null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not check the payment status" },
      { status: 500 },
    );
  }
}
