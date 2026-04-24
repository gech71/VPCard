import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const PREPAID_API_URL = process.env.PREPAID_API_URL;
const PREPAID_API_USER = process.env.PREPAID_API_USER;
const PREPAID_API_PASS = process.env.PREPAID_API_PASS;

const selfRequestSchema = z.object({
  accountNumber: z.coerce.string().min(1, "Account number is required"),
  notes: z.string().optional(),
});

async function getCustomerInfo(accountNumber: string) {
  if (!PREPAID_API_URL || !PREPAID_API_USER || !PREPAID_API_PASS) {
    throw new Error("Prepaid API configuration missing");
  }

  const response = await fetch(`${PREPAID_API_URL}/prepaid/cust-info-by-acct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${PREPAID_API_USER}:${PREPAID_API_PASS}`).toString("base64")}`,
    },
    body: JSON.stringify({ accountNumber }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch customer info: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();
  return data;
}

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

    const { accountNumber, notes } = validation.data;

    // Fetch customer information from prepaid API
    let customerInfo;
    try {
      customerInfo = await getCustomerInfo(accountNumber);
    } catch (error) {
      console.error("Customer info fetch error:", error);
      return NextResponse.json(
        {
          error:
            "Failed to fetch customer information. Please verify the account number.",
        },
        { status: 400 },
      );
    }

    // Extract customer details from API response
    const customerName =
      customerInfo?.customerName || customerInfo?.name || "Unknown";
    const customerEmail =
      customerInfo?.email || customerInfo?.customerEmail || undefined;
    const customerPhone =
      customerInfo?.phone ||
      customerInfo?.mobileNo ||
      customerInfo?.customerPhone ||
      phoneNumber ||
      undefined;
    const customerId =
      customerInfo?.customerId || customerInfo?.id || undefined;

    // Create the card request
    const cardRequest = await prisma.cardRequest.create({
      data: {
        customerId,
        accountNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes: notes ? `Self-request: ${notes}` : "Self-initiated card request",
        makerId,
        checkerId,
      },
    });

    // Create audit logs
    const logUserId = currentUser?.userId || null;

    await createAuditLog({
      userId: logUserId,
      action: "SELF_REQUEST",
      entityType: "CARD_REQUEST",
      entityId: cardRequest.id,
      cardRequestId: cardRequest.id,
      details: {
        accountNumber,
        customerName,
        checkerId,
        isSelfRequest: true,
        authType: currentUser ? "JWT" : "PHONE",
      },
    });

    await createAuditLog({
      userId: logUserId,
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
    console.error("Self request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
