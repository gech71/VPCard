import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  getDecryptedPhoneFromCookie,
  getDecryptedMiniAppToken,
  clearMiniAppTokenCookie,
} from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getCardRequestFeeConfig } from "@/lib/card-request-fee";
import {
  readPaymentEnv,
  requestPaymentToken,
  validateMiniAppToken,
} from "@/lib/nib-payment";

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

    // Check the token against the bank BEFORE spending it on a payment call.
    // Without this, a 401 from the payment endpoint is ambiguous: it could be a
    // stale token (the Guest's problem, fixed by reopening the app) or wrong
    // payment configuration (our problem, which reopening will never fix). The
    // two need different messages, so establish which one it is first.
    if (env.validateUrl) {
      const validPhone = await validateMiniAppToken(`Bearer ${token}`, env.validateUrl);

      if (!validPhone) {
        await clearMiniAppTokenCookie();

        await createAuditLog({
          actorType: "SYSTEM",
          actorId: "GUEST",
          actorEmail: phoneNumber,
          action: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          details: { event: "TOKEN_REJECTED_BY_VALIDATE" },
        });

        return NextResponse.json(
          {
            error:
              "Your payment session has expired. Please close and reopen the card request from the NIBtera app, then try again.",
          },
          { status: 401 },
        );
      }
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
        details: {
          event: "INITIATE_FAILED",
          reason: result.error,
          status: result.status,
          // The bank's own words, surfaced in Audit Logs so a Super Admin can
          // diagnose this without shell access to the server.
          bankResponse: result.detail?.slice(0, 500),
          // The exact signed text, key masked. Compare field by field with NIB
          // when the bank reports a signature problem.
          signatureBase: result.signatureBase,
          paymentUrl: env.paymentUrl,
          accountNo: env.accountNo,
          companyName: env.companyName,
          callbackUrl: env.callbackUrl,
        },
      });

      // The token already passed validation above, so a 401/403 here is not a
      // stale session - it points at the payment configuration (URL, account,
      // company name or signing key). Telling the Guest to reopen the app would
      // send them round a loop that cannot succeed.
      if (result.status === 401 || result.status === 403) {
        return NextResponse.json(
          {
            error:
              "Card payments are temporarily unavailable. Please contact support — this is not a problem with your account.",
          },
          { status: 502 },
        );
      }

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
