import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  checkTransactionStatus,
  decodeTokenClaims,
  normalizeCallbackToken,
  readPaymentEnv,
  redactToken,
  validateMiniAppToken,
} from "@/lib/nib-payment";

/**
 * Step 5 of the MiniApp integration: the bank notifies us of a completed
 * transaction. Responds 200 on success and 400 on failure, as the guideline
 * requires.
 *
 * Two identifiers travel in this payload and they are NOT interchangeable:
 *
 *   - `txnRef` carries the originator id *we* generated in step 3 - the value
 *     stored in `CardRequestPayment.transactionId`;
 *   - `transactionId` carries the *bank's* core-banking reference (for example
 *     "FT25274MSCNV"), which we have never seen before this callback.
 *
 * Looking the payment up by the field named `transactionId` therefore never
 * matches anything. Both fields are tried against our originator id below, and
 * whichever value is not ours is kept as the bank reference in `txnRef`.
 *
 * This endpoint moves money-equivalent state, so it is treated as a
 * *notification* rather than an instruction: the caller has to prove it holds
 * the payment token the bank issued for this exact transaction before anything
 * is marked SUCCESS.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.error("[payment-callback] body was not valid JSON");
    return NextResponse.json({ message: "Error Occured." }, { status: 400 });
  }

  try {
    const {
      paidAmount,
      paidByNumber,
      txnRef,
      transactionId,
      accountNo,
      transactionTime,
    } = body as Record<string, string | undefined>;

    // The guideline capitalises it `Signature`; pre-production sends
    // `signature`. Accept either - it is logged, not enforced, because the
    // guideline never states how the callback signature is derived.
    const receivedSignature =
      (body.signature as string | undefined) ??
      (body.Signature as string | undefined);

    // Sent in the body as `{token: eyJ...}` in pre-production, and per the
    // guideline also as an Authorization header. Either is accepted.
    const authHeader = request.headers.get("Authorization");
    const callbackToken =
      normalizeCallbackToken(body.token as string | undefined) ??
      normalizeCallbackToken(body.Token as string | undefined) ??
      normalizeCallbackToken(authHeader);

    const claims = decodeTokenClaims(callbackToken);
    const claimTransactionId =
      typeof claims?.transactionId === "string" ? claims.transactionId : null;

    console.info("[payment-callback] received", {
      txnRef,
      transactionId,
      paidAmount,
      paidByNumber,
      accountNo,
      transactionTime,
      hasAuthHeader: Boolean(authHeader),
      token: redactToken(callbackToken),
      claimTransactionId,
      signature: receivedSignature,
    });

    if (!txnRef && !transactionId) {
      return NextResponse.json(
        { message: "txnRef or transactionId is required." },
        { status: 400 },
      );
    }

    const env = readPaymentEnv();

    // Our originator id can arrive in either field, and the token's own
    // `transactionId` claim states it a third time. Try all three.
    const candidates = [txnRef, transactionId, claimTransactionId].filter(
      (value): value is string => Boolean(value),
    );

    let payment = await prisma.cardRequestPayment.findFirst({
      where: { transactionId: { in: candidates } },
    });

    // Last resort: the payment token is unique per transaction, so a callback
    // that names no identifier we recognise can still be placed.
    if (!payment && callbackToken) {
      payment = await prisma.cardRequestPayment.findFirst({
        where: { paymentToken: callbackToken },
      });
    }

    if (!payment) {
      console.error("[payment-callback] no payment matches this callback", {
        candidates,
      });
      return NextResponse.json(
        { message: "Unknown transaction." },
        { status: 400 },
      );
    }

    const matched = payment;

    // Whichever identifier is not our originator id is the bank's reference.
    const bankReference =
      [transactionId, txnRef].find(
        (value) => value && value !== matched.transactionId,
      ) ??
      matched.txnRef ??
      null;

    if (matched.status === "SUCCESS") {
      // The bank may retry a callback; confirming twice is not an error.
      return NextResponse.json(
        { message: "Payment already confirmed." },
        { status: 200 },
      );
    }

    // Authenticate the caller. Any one of these proves it holds something only
    // the bank could have produced for *this* payment:
    //
    //   (a) the exact payment token we were handed in step 3,
    //   (b) a token whose claims are bound to this transaction and our account,
    //   (c) or a token the bank's own validation endpoint accepts.
    //
    // Without one of them a caller who guessed an id could grant themselves a
    // free card request.
    const tokenMatchesStored =
      Boolean(callbackToken) && callbackToken === matched.paymentToken;

    const claimsBindToPayment =
      claimTransactionId === matched.transactionId &&
      (!env?.accountNo ||
        typeof claims?.accountNo !== "string" ||
        claims.accountNo === env.accountNo);

    let validatedByBank = false;
    const validateUrl = env?.validateUrl || process.env.TOKEN_VALIDATION_ENDPOINT;

    if (
      !tokenMatchesStored &&
      !claimsBindToPayment &&
      callbackToken &&
      validateUrl
    ) {
      validatedByBank = Boolean(
        await validateMiniAppToken(`Bearer ${callbackToken}`, validateUrl),
      );
    }

    if (!tokenMatchesStored && !claimsBindToPayment && !validatedByBank) {
      console.error("[payment-callback] callback token did not authenticate", {
        transactionId: matched.transactionId,
        token: redactToken(callbackToken),
        claimTransactionId,
      });

      await createAuditLog({
        actorType: "SYSTEM",
        actorId: "PAYMENT_CALLBACK",
        actorEmail: matched.phoneNumber,
        action: "PAYMENT_FAILED",
        entityType: "PAYMENT",
        entityId: matched.id,
        details: {
          event: "CALLBACK_UNAUTHENTICATED",
          transactionId: matched.transactionId,
          bankReference,
          claimTransactionId,
        },
      });

      return NextResponse.json(
        { message: "Authorization token is not valid." },
        { status: 400 },
      );
    }

    // Never let a callback confirm a payment for less than the quoted fee,
    // whatever else it claims.
    const paid = paidAmount != null ? Number(paidAmount) : null;
    const expected = Number(matched.amount);

    if (paid != null && Number.isFinite(paid) && paid + 0.005 < expected) {
      await createAuditLog({
        actorType: "SYSTEM",
        actorId: "PAYMENT_CALLBACK",
        actorEmail: matched.phoneNumber,
        action: "PAYMENT_FAILED",
        entityType: "PAYMENT",
        entityId: matched.id,
        details: {
          event: "CALLBACK_AMOUNT_MISMATCH",
          transactionId: matched.transactionId,
          paidAmount,
          expected,
        },
      });

      return NextResponse.json(
        { message: "Paid amount does not match the requested amount." },
        { status: 400 },
      );
    }

    // Corroborate with the bank where the status endpoint answers. It can veto
    // a callback it reports as FAILED, but it cannot veto one it cannot answer
    // for: the guideline offers that endpoint as a fallback for transactions
    // that were *not* notified in real time, so an unreachable or misconfigured
    // status host must not discard a genuine, authenticated notification.
    let corroborated: "SUCCESS" | "FAILED" | "PENDING" | null = null;

    if (env?.statusUrl) {
      corroborated = await checkTransactionStatus({
        env,
        reference: bankReference || matched.transactionId,
        token: callbackToken ?? undefined,
      });

      if (corroborated === null && bankReference) {
        // Try the originator id too - the bank exposes status under both.
        corroborated = await checkTransactionStatus({
          env,
          reference: matched.transactionId,
          token: callbackToken ?? undefined,
        });
      }

      if (corroborated === "FAILED") {
        await prisma.cardRequestPayment.update({
          where: { id: matched.id },
          data: { status: "FAILED", failureReason: "Declined by the bank" },
        });

        await createAuditLog({
          actorType: "SYSTEM",
          actorId: "PAYMENT_CALLBACK",
          actorEmail: matched.phoneNumber,
          action: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          entityId: matched.id,
          details: {
            event: "CALLBACK_CONTRADICTED",
            transactionId: matched.transactionId,
            bankReference,
            remoteStatus: corroborated,
          },
        });

        return NextResponse.json(
          { message: "Transaction could not be confirmed." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.cardRequestPayment.update({
      where: { id: matched.id },
      data: {
        status: "SUCCESS",
        txnRef: bankReference ?? matched.txnRef,
        paidAmount: paidAmount != null ? String(paidAmount) : matched.paidAmount,
        paidByNumber: paidByNumber ?? matched.paidByNumber,
        paidAt: new Date(),
      },
    });

    await createAuditLog({
      actorType: "SYSTEM",
      actorId: "PAYMENT_CALLBACK",
      actorEmail: matched.phoneNumber,
      action: "PAYMENT_CONFIRMED",
      entityType: "PAYMENT",
      entityId: updated.id,
      details: {
        event: "PAYMENT_CONFIRMED",
        via: "CALLBACK",
        transactionId: matched.transactionId,
        bankReference,
        paidAmount,
        paidByNumber,
        accountNo,
        transactionTime,
        // How the caller proved itself, and whether the bank's status endpoint
        // backed the notification up - both matter when auditing a dispute.
        authenticatedBy: tokenMatchesStored
          ? "STORED_PAYMENT_TOKEN"
          : claimsBindToPayment
            ? "TOKEN_CLAIMS"
            : "BANK_VALIDATION",
        corroboratedStatus: corroborated,
      },
    });

    console.info("[payment-callback] payment confirmed", {
      transactionId: matched.transactionId,
      bankReference,
      corroborated,
    });

    return NextResponse.json(
      { message: "Payment confirmed and updated." },
      { status: 200 },
    );
  } catch (err) {
    // Logged rather than swallowed: a silent 400 here looks identical to a
    // rejected callback, which is exactly what made this hard to diagnose.
    console.error("[payment-callback] unhandled error", err);
    return NextResponse.json({ message: "Error Occured." }, { status: 400 });
  }
}
