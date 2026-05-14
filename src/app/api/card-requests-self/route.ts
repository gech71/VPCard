import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import {
  assertCardProgramAllowed,
  defaultPrepaidProgram,
} from "@/lib/card-programs";
import {
  fetchCustInfoByAccount,
  getCustDetailFromResponse,
} from "@/lib/prepaid-api";
import { extractPssFieldsFromCustDetail } from "@/lib/cust-detail";

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
    } = validation.data;

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

    const customerIdRaw =
      detail.CustomerId ||
      detail.customerId ||
      detail.customerID ||
      detail.id;
    const customerId = customerIdRaw ? String(customerIdRaw) : undefined;

    const pssMeta = extractPssFieldsFromCustDetail(detail);

    const cardRequest = await prisma.cardRequest.create({
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
      },
    });

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
