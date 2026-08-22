import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { decryptCardData, maskPan } from "@/lib/card-encryption";
import { activatePssEcommerce } from "@/lib/pss-ecommerce-activation";
import { getEcommerceActivationState } from "@/lib/ecommerce-eligibility";

/**
 * Explicitly activate e-commerce for an already-approved card.
 *
 * This is the only place activation is triggered. Card approval no longer does
 * it - it just creates the card at PSS with e-commerce off. The PSS call itself
 * is unchanged and still goes through activatePssEcommerce().
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "CHECKER") {
      return NextResponse.json(
        { error: "Only Checkers can activate e-commerce" },
        { status: 403 },
      );
    }

    const requestId = request.nextUrl.pathname.split("/").pop();

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 },
      );
    }

    const cardRequest = await prisma.cardRequest.findUnique({
      where: { id: requestId },
    });

    if (!cardRequest) {
      return NextResponse.json(
        { error: "Card request not found" },
        { status: 404 },
      );
    }

    // Same ownership rule as approval: only the assigned checker may act.
    if (cardRequest.checkerId !== currentUser.userId) {
      return NextResponse.json(
        { error: "This request is not assigned to you" },
        { status: 403 },
      );
    }

    const state = getEcommerceActivationState({
      status: cardRequest.status,
      pan: cardRequest.pan,
      ecommerceActivated: cardRequest.ecommerceActivated,
    });

    if (state === "ACTIVATED") {
      return NextResponse.json(
        { error: "E-commerce is already active for this card" },
        { status: 409 },
      );
    }

    if (state === "AWAITING_APPROVAL") {
      return NextResponse.json(
        { error: "This card request has not been approved yet" },
        { status: 400 },
      );
    }

    if (state === "MISSING_CARD") {
      return NextResponse.json(
        { error: "No card number is recorded against this request" },
        { status: 400 },
      );
    }

    if (state !== "ELIGIBLE") {
      return NextResponse.json(
        { error: "This card is not eligible for e-commerce activation" },
        { status: 400 },
      );
    }

    const activationUrl = process.env.ECOMMERCE_ACTIVATION_URL || "";
    const activationKey = process.env.ECOMMERCE_ACTIVATION_KEY || "";
    const idmsg = process.env.CARD_LIST_ID_MSG || "";
    const bankcode =
      process.env.CARD_LIST_BANK_CODE ||
      process.env.CARD_LIST_INSTITUTION ||
      process.env.PIN_CHANGE_INSTITUTION ||
      "";

    if (!activationUrl || !idmsg || !bankcode) {
      return NextResponse.json(
        { error: "Server configuration error for ecommerce activation" },
        { status: 500 },
      );
    }

    const encryptionSecret = process.env.ENCRYPTION_SECRET_KEY || "";

    let panPlaintext: string;
    try {
      panPlaintext = decryptCardData(cardRequest.pan as string, encryptionSecret);
    } catch {
      return NextResponse.json(
        { error: "Stored card number could not be read" },
        { status: 500 },
      );
    }

    try {
      await activatePssEcommerce({
        url: activationUrl,
        apiKey: activationKey,
        idmsg,
        bankcode,
        card: panPlaintext,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";

      await createAuditLog({
        actorType: "USER",
        actorId: currentUser.userId,
        actorEmail: currentUser.email,
        action: "ACTIVATE_ECOMMERCE_FAILED",
        entityType: "CARD_REQUEST",
        entityId: cardRequest.id,
        cardRequestId: cardRequest.id,
        details: {
          accountNumber: cardRequest.accountNumber,
          customerName: cardRequest.customerName,
          error: message,
        },
      });

      return NextResponse.json(
        { error: "PSS Ecommerce Activation Error: " + message },
        { status: 400 },
      );
    }

    // Only flip the flag once PSS has confirmed activation.
    const updated = await prisma.cardRequest.update({
      where: { id: cardRequest.id },
      data: {
        ecommerceActivated: true,
        ecommerceActivatedAt: new Date(),
        ecommerceActivatedBy: currentUser.userId,
      },
      select: {
        id: true,
        ecommerceActivated: true,
        ecommerceActivatedAt: true,
      },
    });

    await createAuditLog({
      actorType: "USER",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "ACTIVATE_ECOMMERCE",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: {
        accountNumber: cardRequest.accountNumber,
        customerName: cardRequest.customerName,
        maskedPan: maskPan(cardRequest.pan as string),
      },
    });

    return NextResponse.json({
      success: true,
      message: "E-commerce activated successfully",
      request: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
