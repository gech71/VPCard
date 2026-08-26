import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { resolveTermsAcceptance } from "@/lib/terms";
import { getCardRequestFeeConfig } from "@/lib/card-request-fee";
import { z } from "zod";
import {
  assertCardProgramAllowed,
  defaultPrepaidProgram,
} from "@/lib/card-programs";
import {
  fetchCustInfoByAccount,
  getCustDetailFromResponse,
} from "@/lib/prepaid-api";
import {
  extractCustomerIdFromCustDetail,
  extractPssFieldsFromCustDetail,
} from "@/lib/cust-detail";
import { cacheCustomerIdMappings } from "@/lib/customer-id-cache";
import {
  VERIFICATION_TTL_MS,
  normaliseEmail,
} from "@/lib/server/email-otp";

const selfRequestSchema = z.object({
  accountNumber: z.coerce.string().regex(/^7000\d{9}$/, "Account number must start with 7000 and be exactly 13 digits"),
  customerEmail: z.string().email("Invalid email format"),
  cardProgramCode: z.coerce
    .string()
    .min(1, "Card program is required")
    .regex(/^\d+$/, "Invalid card program code"),
  customerPhone: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    let phone = val.trim();
    if (phone.startsWith("251")) return `+${phone}`;
    if (phone.startsWith("0")) return `+251${phone.slice(1)}`;
    return phone;
  }, z.string().regex(/^\+251(9|7)\d{8}$/, "Invalid phone format")).optional(),
  notes: z.string().optional(),
  // Agreement to the Terms & Conditions in force. Enforced server-side -
  // the checkbox on the form is a convenience, not the control.
  termsAccepted: z.boolean().optional(),
  termsVersionId: z.string().optional(),
  /// Guest card-request fee payment, when the Super Admin has one switched on.
  paymentTransactionId: z.string().optional(),
});

// Create a self-initiated card request
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const phoneNumber = await getDecryptedPhoneFromCookie();

    // Support both standard JWT auth and legacy phone authentication
    if (!currentUser && !phoneNumber) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if self card request is enabled
    const allowSelfCardRequestSetting = await prisma.settings.findUnique({
      where: { key: "allowSelfCardRequest" },
    });

    if (
      !allowSelfCardRequestSetting ||
      allowSelfCardRequestSetting.value !== "true"
    ) {
      return NextResponse.json(
        { error: "Self-initiated card requests are not enabled" },
        { status: 403 },
      );
    }

    // Get the default checker from settings
    const defaultCheckerSetting = await prisma.settings.findUnique({
      where: { key: "defaultCheckerId" },
    });

    if (!defaultCheckerSetting || !defaultCheckerSetting.value) {
      return NextResponse.json(
        { error: "No default checker configured. Please contact admin." },
        { status: 400 },
      );
    }

    const checkerId = defaultCheckerSetting.value;

    // Verify checker exists and has CHECKER role
    const checker = await prisma.user.findFirst({
      where: { id: checkerId, role: "CHECKER" },
    });

    if (!checker) {
      return NextResponse.json(
        { error: "Configured checker not found. Please contact admin." },
        { status: 400 },
      );
    }

    // Determine maker ID (use current user ID or fallback to checker ID for legacy phone users)
    const makerId = currentUser?.userId || checkerId;

    const body = await request.json();
    const validation = selfRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const {
      accountNumber,
      customerEmail,
      customerPhone: providedPhone,
      notes,
      cardProgramCode,
      termsAccepted,
      termsVersionId,
      paymentTransactionId,
    } = validation.data;

    // Refuse the request outright unless the submitter agreed to the terms
    // currently in force. Returns the columns that record which version was
    // accepted and when.
    const terms = await resolveTermsAcceptance({ termsAccepted, termsVersionId });

    if (!terms.ok) {
      return NextResponse.json({ error: terms.error }, { status: 400 });
    }

    // Guest card-request fee. Only a Guest MiniApp session pays: any
    // signed-in user reaching this endpoint - a Maker above all - is exempt
    // under every configuration, per the business rules.
    const isGuest = !currentUser && Boolean(phoneNumber);
    const feeConfig = await getCardRequestFeeConfig();
    let paidPaymentId: string | null = null;

    if (isGuest && feeConfig.paymentEnforced) {
      if (!paymentTransactionId) {
        return NextResponse.json(
          {
            error:
              "Payment is required before this card request can be submitted.",
            paymentRequired: true,
          },
          { status: 402 },
        );
      }

      const payment = await prisma.cardRequestPayment.findUnique({
        where: { transactionId: paymentTransactionId },
        include: { cardRequest: { select: { id: true } } },
      });

      // Scoped to the paying Guest so one session cannot spend another
      // session's payment.
      if (!payment || payment.phoneNumber !== phoneNumber) {
        return NextResponse.json(
          { error: "No payment was found for this session.", paymentRequired: true },
          { status: 402 },
        );
      }

      if (payment.status !== "SUCCESS") {
        return NextResponse.json(
          {
            error:
              "Your payment has not been confirmed yet. Complete the payment before submitting.",
            paymentRequired: true,
          },
          { status: 402 },
        );
      }

      if (payment.cardRequest) {
        return NextResponse.json(
          {
            error:
              "This payment has already been used for another card request.",
            paymentRequired: true,
          },
          { status: 409 },
        );
      }

      // The fee may have been raised after this Guest paid.
      if (Number(payment.amount) < feeConfig.amount) {
        return NextResponse.json(
          {
            error:
              "The card request fee has changed since you paid. Please start a new request.",
            paymentRequired: true,
          },
          { status: 402 },
        );
      }

      paidPaymentId = payment.id;
    }

    // The email on a Guest request must have been proved reachable. The code
    // exchange happens on its own endpoints; this is the control - a client
    // that skips the whole dance still cannot submit.
    let emailVerificationId: string | null = null;

    if (isGuest) {
      // isGuest already implies a phone number; checked again so the guard
      // fails closed rather than querying with a null subject.
      if (!phoneNumber) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const verifiedEmail = normaliseEmail(customerEmail);

      const verification = await prisma.emailVerification.findFirst({
        where: {
          phoneNumber,
          email: verifiedEmail,
          verifiedAt: { not: null, gt: new Date(Date.now() - VERIFICATION_TTL_MS) },
          consumedAt: null,
        },
        orderBy: { verifiedAt: "desc" },
        select: { id: true },
      });

      if (!verification) {
        return NextResponse.json(
          {
            error:
              "Verify your email address before submitting this card request.",
            emailVerificationRequired: true,
          },
          { status: 403 },
        );
      }

      emailVerificationId = verification.id;
    }

    const programAllowed = await assertCardProgramAllowed(
      cardProgramCode,
      "self",
    );
    if (!programAllowed.ok) {
      return NextResponse.json(
        { error: programAllowed.error },
        { status: 400 },
      );
    }

    const program = await prisma.cardProgram.findUnique({
      where: { code: cardProgramCode },
    });
    if (!program) {
      return NextResponse.json(
        { error: "Unknown card program code." },
        { status: 400 },
      );
    }

    // Check if there's already a pending request for this account number
    const existingPendingRequest = await prisma.cardRequest.findFirst({
      where: {
        accountNumber,
        status: "PENDING",
      },
    });

    if (existingPendingRequest) {
      return NextResponse.json(
        { error: "There is already a pending card request for this account number." },
        { status: 400 },
      );
    }

    let customerInfo: unknown;
    try {
      customerInfo = await fetchCustInfoByAccount(accountNumber);
    } catch {
      return NextResponse.json(
        {
          error:
            "Failed to fetch customer information. Please verify the account number.",
        },
        { status: 400 },
      );
    }

    const envelope = customerInfo as { status?: string };
    if (
      envelope.status &&
      String(envelope.status).toLowerCase() !== "success"
    ) {
      return NextResponse.json(
        { error: "Customer lookup did not succeed for this account." },
        { status: 400 },
      );
    }

    const detail = getCustDetailFromResponse(customerInfo);

    const customerName =
      (detail.CustomerName ||
        detail.customerName ||
        detail.name ||
        detail.custName ||
        "Unknown") as string;

    const finalEmail =
      customerEmail ||
      (detail.Email as string | undefined) ||
      (detail.email as string | undefined) ||
      undefined;

    const customerPhone =
      providedPhone ||
      phoneNumber ||
      (detail.PhoneNumber as string | undefined) ||
      (detail.phoneNumber as string | undefined) ||
      (detail.phone as string | undefined) ||
      (detail.mobile as string | undefined) ||
      (detail.mobileNo as string | undefined) ||
      (detail.customerPhone as string | undefined) ||
      undefined;

    const customerId = extractCustomerIdFromCustDetail(detail);

    const pssMeta = extractPssFieldsFromCustDetail(detail);

    if (customerId) {
      await cacheCustomerIdMappings({
        customerId,
        phoneNumber: customerPhone ?? phoneNumber,
        accountNumbers: [accountNumber],
      });
    }

    // The unique paymentId column is what ultimately stops one payment
    // buying two card requests: if two submissions race, the second create
    // violates the constraint rather than quietly succeeding.
    let cardRequest;

    try {
      cardRequest = await prisma.cardRequest.create({
      data: {
        customerId,
        accountNumber,
        customerName,
        customerEmail: finalEmail,
        customerPhone,
        notes: notes ? `Self-request: ${notes}` : "Self-initiated card request",
        makerId,
        checkerId,
        cardProgramCode: program.code,
        cardProgramName: program.name,
        prepaidProgram: defaultPrepaidProgram(program.prepaidProgram),
        branchCode: pssMeta.branchcode || null,
        genderCode: pssMeta.gender,
        title: pssMeta.title || null,
        ...terms.data,
        paymentId: paidPaymentId,
      },
      });
    } catch (err) {
      if (
        paidPaymentId &&
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json(
          {
            error:
              "This payment has already been used for another card request.",
            paymentRequired: true,
          },
          { status: 409 },
        );
      }
      throw err;
    }

    // Spent, so the same proof cannot authorise a second request. Scoped to a
    // still-unconsumed row, so a racing submission finds nothing to spend.
    if (emailVerificationId) {
      await prisma.emailVerification.updateMany({
        where: { id: emailVerificationId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    }

    // Create audit logs
    const logUserId = currentUser?.userId || null;
    const actorType = currentUser ? "USER" : "SYSTEM"; // System if phone-based/unauthenticated

    await createAuditLog({
      actorType,
      actorId: logUserId || "PHONE_USER",
      actorEmail: currentUser?.email || phoneNumber || "unknown",
      action: "SELF_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: {
        accountNumber,
        customerName,
        checkerId,
        cardProgramCode,
        isSelfRequest: true,
        authType: currentUser ? "JWT" : "PHONE",
      },
    });
    // Surface the agreement in the audit trail as well as on the request row.
    if (terms.data.termsVersionId) {
      await createAuditLog({
        actorType,
        actorId: logUserId || "PHONE_USER",
        actorEmail: currentUser?.email || phoneNumber || "unknown",
        action: "ACCEPT_TERMS",
        entityType: "TERMS",
        entityId: terms.data.termsVersionId,
        cardRequestId: cardRequest.id,
        details: {
          event: "ACCEPT_TERMS",
          termsVersion: terms.data.termsVersionNo,
          acceptedAt: terms.data.termsAcceptedAt?.toISOString(),
          isSelfRequest: true,
        },
      });
    }

    await createAuditLog({
      actorType,
      actorId: logUserId || "PHONE_USER",
      actorEmail: currentUser?.email || phoneNumber || "unknown",
      action: "ASSIGN_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: {
        assignedTo: checker.email,
        isSelfRequest: true,
        authType: currentUser ? "JWT" : "PHONE",
      },
    });

    return NextResponse.json({
      success: true,
      request: cardRequest,
      message: "Card request submitted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
