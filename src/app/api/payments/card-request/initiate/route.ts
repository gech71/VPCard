import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getDecryptedPhoneFromCookie, getDecryptedMiniAppToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getCardRequestFeeConfig } from "@/lib/card-request-fee";
import { readPaymentEnv, requestPaymentToken } from "@/lib/nib-payment";

/**
 * Step 3 of the MiniApp integration: ask the bank for a payment token for the
 * Guest's card-request fee.
 *
 * The amount always comes from the Super Admin configuration read here - it is
 * never accepted from the client, so a tampered request cannot pay less.
 */
export async function POST() {
  try {
    const phoneNumber = await getDecryptedPhoneFromCookie();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Your session has expired. Please reopen the card request." },
        { status: 401 },
      );
    }

    const config = await getCardRequestFeeConfig();

    if (!config.paymentEnforced) {
      return NextResponse.json(
        { error: "Card requests are currently free - no payment is needed." },
        { status: 409 },
      );
    }

    // Reuse an unspent payment rather than charging again.
    const existing = await prisma.cardRequestPayment.findFirst({
      where: { phoneNumber, status: "SUCCESS", cardRequest: null },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        alreadyPaid: true,
        transactionId: existing.transactionId,
      });
    }

    const env = readPaymentEnv();

    if (!env) {
      return NextResponse.json(
        {
          error:
            "Payments are not configured on this server. Contact your administrator.",
        },
        { status: 503 },
      );
    }

    const token = await getDecryptedMiniAppToken();

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Your payment session is unavailable. Please reopen the mini app and try again.",
        },
        { status: 401 },
      );
    }

    const result = await requestPaymentToken({
      env,
      amount: config.amount,
      token,
    });

    if (!result.ok) {
      await createAuditLog({
        actorType: "SYSTEM",
        actorId: "GUEST",
        actorEmail: phoneNumber,
        action: "PAYMENT_FAILED",
        entityType: "PAYMENT",
        details: { event: "INITIATE_FAILED", reason: result.error },
      });

      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Recorded PENDING. Only the bank's confirmation moves it to SUCCESS.
    const payment = await prisma.cardRequestPayment.create({
      data: {
        transactionId: result.transactionId,
        phoneNumber,
        amount: config.amount,
        currency: config.currency,
        status: "PENDING",
        paymentToken: result.paymentToken,
      },
    });

    await createAuditLog({
      actorType: "SYSTEM",
      actorId: "GUEST",
      actorEmail: phoneNumber,
      action: "INITIATE_PAYMENT",
      entityType: "PAYMENT",
      entityId: payment.id,
      details: {
        event: "INITIATE_PAYMENT",
        transactionId: result.transactionId,
        amount: config.amount,
        currency: config.currency,
      },
    });

    return NextResponse.json({
      alreadyPaid: false,
      // Step 4 posts this to the Super App over window.myJsChannel.
      paymentToken: result.paymentToken,
      transactionId: result.transactionId,
      amount: config.amount,
      currency: config.currency,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not start the payment" },
      { status: 500 },
    );
  }
}
