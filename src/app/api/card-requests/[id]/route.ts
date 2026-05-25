import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { encryptCardData } from "@/lib/card-encryption";
import { z } from "zod";
import { fetchPss } from "@/lib/pss-fetch";
import { buildPssVirtualCardInitiator } from "@/lib/pss-virtual-card";
import { activatePssEcommerce } from "@/lib/pss-ecommerce-activation";
import {
  fetchPssCardListByCustomerId,
  resolveCustomertypeFromCardBins,
} from "@/lib/pss-card-list";

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

    const requestId = request.nextUrl.pathname.split("/").pop();

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

    let pan: string | null = null;
    let cvv: string | null = null;
    let expiryDate: string | null = null;

    if (action === "APPROVE") {
      const pssUrl = process.env.VIRTUAL_CARD_CREATION_URL || "";
      const apiKey = process.env.CARD_LIST_API_KEY || "";
      const idmsg = process.env.CARD_LIST_ID_MSG || "";
      const institution = process.env.PIN_CHANGE_INSTITUTION;
      const cardListUrl = process.env.CARD_LIST_URL || "";
      const cardListInstitution =
        process.env.CARD_LIST_INSTITUTION || institution || "";

      if (!pssUrl || !apiKey || !idmsg) {
        return NextResponse.json(
          { error: "Server configuration error for virtual card creation" },
          { status: 500 },
        );
      }

      const ecommerceActivationUrl = process.env.ECOMMERCE_ACTIVATION_URL || "";
      const ecommerceActivationKey = process.env.ECOMMERCE_ACTIVATION_KEY || "";
      const ecommerceActivationBankCode =
        process.env.CARD_LIST_BANK_CODE || cardListInstitution || "";

      const allPrograms = await prisma.cardProgram.findMany({
        select: { bin: true },
      });
      const allBins = allPrograms.map((p) => p.bin);

      let customerType: "O" | "N" = "N";
      if (
        cardRequest.customerId &&
        cardListUrl &&
        apiKey &&
        idmsg &&
        cardListInstitution
      ) {
        try {
          const listCards = await fetchPssCardListByCustomerId({
            customerId: String(cardRequest.customerId),
            institution: String(cardListInstitution),
            cardListUrl,
            apiKey,
            idmsg,
          });
          customerType = resolveCustomertypeFromCardBins(listCards, allBins);
        } catch {
          customerType = "N";
        }
      }

      const initiator = await buildPssVirtualCardInitiator(
        {
          customerId: cardRequest.customerId,
          accountNumber: cardRequest.accountNumber,
          customerName: cardRequest.customerName,
          customerEmail: cardRequest.customerEmail,
          customerPhone: cardRequest.customerPhone,
          cardProgramCode: cardRequest.cardProgramCode,
          prepaidProgram: cardRequest.prepaidProgram,
          branchCode: cardRequest.branchCode,
          genderCode: cardRequest.genderCode,
          title: cardRequest.title,
        },
        institution,
        customerType,
      );

      const pssPayload = {
        header: { idmsg },
        initiator,
      };

      try {
        const pssResponse = await fetchPss(pssUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ApiKey: apiKey,
          },
          body: JSON.stringify(pssPayload),
        });

        const responseData = await pssResponse.json();
        const statusObj = responseData?.response?.body?.status;

        if (statusObj?.errorcode === "000") {
          const additionalData = responseData.response.body.additionaldata;
          const panPlaintext = additionalData?.PAN || null;
          const cvv = additionalData?.cvv2 || null; // CVV received but NOT stored
          const expiryDatePlaintext = additionalData?.["expiry date"] || null;

          if (!panPlaintext) {
            return NextResponse.json(
              { error: "PSS Error: PAN was not returned for activation" },
              { status: 400 },
            );
          }

          if (!ecommerceActivationBankCode) {
            return NextResponse.json(
              { error: "Server configuration error for ecommerce activation" },
              { status: 500 },
            );
          }

          try {
            await activatePssEcommerce({
              url: ecommerceActivationUrl,
              apiKey: ecommerceActivationKey,
              idmsg,
              bankcode: ecommerceActivationBankCode,
              card: panPlaintext,
            });
          } catch (err) {
            return NextResponse.json(
              {
                error:
                  "PSS Ecommerce Activation Error: " +
                  (err instanceof Error ? err.message : "Unknown error"),
              },
              { status: 400 },
            );
          }

          // Encrypt PAN and expiryDate before storage (PCI DSS Requirement 3.4)
          const encryptionSecret = process.env.ENCRYPTION_SECRET_KEY || "";
          pan = panPlaintext
            ? encryptCardData(panPlaintext, encryptionSecret)
            : null;
          expiryDate = expiryDatePlaintext
            ? encryptCardData(expiryDatePlaintext, encryptionSecret)
            : null;

          // CVV is intentionally NOT stored - PCI DSS strictly prohibits storing CVV after authorization
          // CVV should only exist in memory briefly and be discarded
        } else {
          return NextResponse.json(
            {
              error: "PSS Error: " + (statusObj?.errordesc || "Unknown error"),
            },
            { status: 400 },
          );
        }
      } catch (err) {
        return NextResponse.json(
          { error: "Failed to connect to PSS virtual card system" },
          { status: 500 },
        );
      }
    }

    // Update the request
    const updatedRequest = await prisma.cardRequest.update({
      where: { id: requestId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedBy: currentUser.userId,
        reviewedAt: new Date(),
        reviewNotes,
        pan,
        expiryDate,
      },
    });

    // Create audit log
    const auditAction =
      action === "APPROVE" ? "APPROVE_REQUEST" : "REJECT_REQUEST";
    await createAuditLog({
      actorType: "USER", // Checker is a USER actor
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
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

    return NextResponse.json({
      success: true,
      request: updatedRequest,
    });
  } catch (error) {
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

    const requestId = request.nextUrl.pathname.split("/").pop();

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
      actorType: "USER",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "VIEW_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
    });

    return NextResponse.json({ request: cardRequest });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
