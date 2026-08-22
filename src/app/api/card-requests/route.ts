import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { resolveTermsAcceptance } from "@/lib/terms";
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
import { cacheCustomerIdMappings } from "@/lib/customer-id-cache";

const createRequestSchema = z.object({
  customerId: z.string().optional(),
  accountNumber: z.string().regex(/^7000\d{9}$/, "Account number must start with 7000 and be exactly 13 digits"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    let phone = val.trim();
    if (phone.startsWith("251")) return `+${phone}`;
    if (phone.startsWith("0")) return `+251${phone.slice(1)}`;
    return phone;
  }, z.string().regex(/^\+251(9|7)\d{8}$/, "Phone number must be in the format +251XXXXXXXXX (starting with 9 or 7)")),
  checkerId: z.string().uuid("Invalid checker ID"),
  cardProgramCode: z.coerce
    .string()
    .min(1, "Card program is required")
    .regex(/^\d+$/, "Invalid card program code"),
  notes: z.string().optional(),
  // Agreement to the Terms & Conditions in force. Enforced server-side -
  // the checkbox on the form is a convenience, not the control.
  termsAccepted: z.boolean().optional(),
  termsVersionId: z.string().optional(),
});

// Create a new card request (Maker only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "MAKER") {
      return NextResponse.json(
        { error: "Only Makers can create card requests" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const validation = createRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const {
      customerId,
      accountNumber,
      customerName,
      customerEmail,
      customerPhone,
      checkerId,
      cardProgramCode,
      notes,
      termsAccepted,
      termsVersionId,
    } = validation.data;

    // Refuse the request outright unless the submitter agreed to the terms
    // currently in force. Returns the columns that record which version was
    // accepted and when.
    const terms = await resolveTermsAcceptance({ termsAccepted, termsVersionId });

    if (!terms.ok) {
      return NextResponse.json({ error: terms.error }, { status: 400 });
    }

    const programAllowed = await assertCardProgramAllowed(
      cardProgramCode,
      "maker",
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

    let custEnvelope: unknown;
    try {
      custEnvelope = await fetchCustInfoByAccount(accountNumber);
    } catch {
      return NextResponse.json(
        {
          error:
            "Failed to verify customer information. Please verify the account number.",
        },
        { status: 400 },
      );
    }

    const env = custEnvelope as { status?: string };
    if (
      env.status &&
      String(env.status).toLowerCase() !== "success"
    ) {
      return NextResponse.json(
        { error: "Customer lookup did not succeed for this account." },
        { status: 400 },
      );
    }

    const detail = getCustDetailFromResponse(custEnvelope);
    const pssMeta = extractPssFieldsFromCustDetail(detail);

    const resolvedCustomerId = customerId?.trim() || undefined;
    if (resolvedCustomerId) {
      await cacheCustomerIdMappings({
        customerId: resolvedCustomerId,
        phoneNumber: customerPhone,
        accountNumbers: [accountNumber],
      });
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

    // Verify checker exists and has CHECKER role
    const checker = await prisma.user.findFirst({
      where: { id: checkerId, role: "CHECKER" },
    });

    if (!checker) {
      return NextResponse.json(
        { error: "Invalid checker selected" },
        { status: 400 },
      );
    }

    // Create the card request
    const cardRequest = await prisma.cardRequest.create({
      data: {
        customerId: resolvedCustomerId,
        accountNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        makerId: currentUser.userId,
        checkerId,
        cardProgramCode: program.code,
        cardProgramName: program.name,
        prepaidProgram: defaultPrepaidProgram(program.prepaidProgram),
        branchCode: pssMeta.branchcode || null,
        genderCode: pssMeta.gender,
        title: pssMeta.title || null,
        ...terms.data,
      },
    });

    // Create audit log
    await createAuditLog({
      actorType: "USER",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "CREATE_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: { accountNumber, customerName, checkerId, cardProgramCode },
    });

    await createAuditLog({
      actorType: "USER",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "ASSIGN_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: { assignedTo: checker.email },
    });

    // Surface the agreement in the audit trail as well as on the request row.
    if (terms.data.termsVersionId) {
      await createAuditLog({
        actorType: "USER",
        actorId: currentUser.userId,
        actorEmail: currentUser.email,
        action: "ACCEPT_TERMS",
        entityType: "TERMS",
        entityId: terms.data.termsVersionId,
        cardRequestId: cardRequest.id,
        details: {
          event: "ACCEPT_TERMS",
          termsVersion: terms.data.termsVersionNo,
          acceptedAt: terms.data.termsAcceptedAt?.toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      request: cardRequest,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Get card requests based on user role
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type"); // 'created' or 'assigned'

    let whereClause: Record<string, unknown> = {};

    if (currentUser.role === "MAKER") {
      if (type === "assigned") {
        // Makers don't have assigned requests
        whereClause = { makerId: "none" };
      } else {
        // Default: show requests created by this maker
        whereClause = { makerId: currentUser.userId };
      }
    } else if (currentUser.role === "CHECKER") {
      if (type === "created") {
        // Checkers don't create requests
        whereClause = { makerId: "none" };
      } else {
        // Default: show requests assigned to this checker
        whereClause = { checkerId: currentUser.userId };
      }
    }

    // Filter by status if provided
    if (status) {
      whereClause.status = status.toUpperCase();
    }

    const requests = await prisma.cardRequest.findMany({
      where: whereClause,
      include: {
        maker: {
          select: { email: true, role: true },
        },
        checker: {
          select: { email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
