import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  checkTransactionStatus,
  readPaymentEnv,
  validateMiniAppToken,
} from "@/lib/nib-payment";

/**
 * Step 5 of the MiniApp integration: the bank notifies us of a completed
 * transaction. Responds 200 on success and 400 on failure, as the guideline
 * requires.
 *
 * This endpoint moves money-equivalent state, so it is treated as a
 * *notification* rather than an instruction. Three things must line up before a
 * payment is marked SUCCESS:
 *
 *   1. the Authorization token validates against the bank (step 1 procedure),
 *   2. the transactionId matches a payment we ourselves created, and
 *   3. where a status endpoint is configured, the bank independently confirms
 *      the transaction.
 *
 * Without (3) a caller who guessed a transactionId and held any valid MiniApp
 * token could grant themselves a free card request.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Error Occured." }, { status: 400 });
  }

  try {
    const {
      paidAmount,
      paidByNumber,
      txnRef,
      transactionId,
      accountNo,
    } = body as Record<string, string | undefined>;

    if (!transactionId) {
      return NextResponse.json(
        { message: "transactionId is required." },
        { status: 400 },
      );
    }

    const env = readPaymentEnv();
    const authHeader = request.headers.get("Authorization");

    // (1) Validate the caller's token exactly as step 1 describes.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Authorization header is missing or malformed." },
        { status: 400 },
      );
    }

    const validateUrl = env?.validateUrl || process.env.TOKEN_VALIDATION_ENDPOINT;

    if (!validateUrl) {
      return NextResponse.json(
        { message: "Token validation is not configured." },
        { status: 400 },
      );
    }

    const callerPhone = await validateMiniAppToken(authHeader, validateUrl);

    if (!callerPhone) {
      return NextResponse.json(
        { message: "Authorization token is not valid." },
        { status: 400 },
      );
    }

    // (2) Must correspond to a payment this system started.
    const payment = await prisma.cardRequestPayment.findUnique({
      where: { transactionId },
    });

    if (!payment) {
      return NextResponse.json(
        { message: "Unknown transaction." },
        { status: 400 },
      );
    }

    if (payment.status === "SUCCESS") {
      // The bank may retry a callback; confirming twice is not an error.
      return NextResponse.json(
        { message: "Payment already confirmed." },
        { status: 200 },
      );
    }

    // (3) Corroborate with the bank before believing the payload.
    if (env?.statusUrl) {
      const remote = await checkTransactionStatus({
        env,
        reference: txnRef || transactionId,
        token: authHeader.slice(7),
      });

      if (remote !== "SUCCESS") {
        await createAuditLog({
          actorType: "SYSTEM",
          actorId: "PAYMENT_CALLBACK",
          actorEmail: payment.phoneNumber,
          action: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          entityId: payment.id,
          details: {
            event: "CALLBACK_UNCONFIRMED",
            transactionId,
            remoteStatus: remote,
          },
        });

        return NextResponse.json(
          { message: "Transaction could not be confirmed." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.cardRequestPayment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        txnRef: txnRef ?? payment.txnRef,
        paidAmount: paidAmount != null ? String(paidAmount) : payment.paidAmount,
        paidByNumber: paidByNumber ?? payment.paidByNumber,
        paidAt: new Date(),
      },
    });

    await createAuditLog({
      actorType: "SYSTEM",
      actorId: "PAYMENT_CALLBACK",
      actorEmail: payment.phoneNumber,
      action: "PAYMENT_CONFIRMED",
      entityType: "PAYMENT",
      entityId: updated.id,
      details: {
        event: "PAYMENT_CONFIRMED",
        via: "CALLBACK",
        transactionId,
        txnRef,
        paidAmount,
        paidByNumber,
        accountNo,
      },
    });

    return NextResponse.json(
      { message: "Payment confirmed and updated." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ message: "Error Occured." }, { status: 400 });
  }
}
