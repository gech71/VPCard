import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { getCardRequestFeeConfig } from "@/lib/card-request-fee";

/** How recently a PENDING payment must have been opened to be resumed. */
const PENDING_RESUME_WINDOW_MS = 15 * 60 * 1000;

/**
 * What a Guest needs to know before starting a card request: whether it costs
 * anything, how much, and whether they have already paid for an attempt they
 * did not finish.
 *
 * Read live on every request, which is what makes the Super Admin's toggle take
 * effect immediately without a redeploy.
 */
export async function GET() {
  try {
    const config = await getCardRequestFeeConfig();
    const phoneNumber = await getDecryptedPhoneFromCookie();

    // Only the enforced decision and the amount are exposed - the Guest has no
    // business knowing which of the two admin switches produced it.
    const base = {
      paymentRequired: config.paymentEnforced,
      amount: config.paymentEnforced ? config.amount : 0,
      currency: config.currency,
    };

    if (!config.paymentEnforced || !phoneNumber) {
      return NextResponse.json({
        ...base,
        existingPayment: null,
        pendingPayment: null,
      });
    }

    // A Guest who paid and then abandoned the form must not be charged twice:
    // an unspent successful payment is picked up on their next attempt.
    const [existing, pending] = await Promise.all([
      prisma.cardRequestPayment.findFirst({
        where: { phoneNumber, status: "SUCCESS", cardRequest: null },
        orderBy: { createdAt: "desc" },
        select: {
          transactionId: true,
          amount: true,
          currency: true,
          paidAt: true,
        },
      }),
      // The Super App reloads this WebView as soon as its payment sheet closes,
      // which is often before the bank's confirmation has reached us. A payment
      // opened moments ago is still being settled, so the Guest should be shown
      // it being confirmed - not a fresh Pay button that would charge again.
      prisma.cardRequestPayment.findFirst({
        where: {
          phoneNumber,
          status: "PENDING",
          cardRequest: null,
          createdAt: { gte: new Date(Date.now() - PENDING_RESUME_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
        select: { transactionId: true },
      }),
    ]);

    return NextResponse.json({
      ...base,
      existingPayment: existing
        ? {
            transactionId: existing.transactionId,
            amount: Number(existing.amount),
            currency: existing.currency,
            paidAt: existing.paidAt,
          }
        : null,
      // Only relevant when nothing has been paid yet.
      pendingPayment:
        !existing && pending ? { transactionId: pending.transactionId } : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load the card request fee" },
      { status: 500 },
    );
  }
}
