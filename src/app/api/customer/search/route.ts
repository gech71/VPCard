import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";

const PREPAID_API_URL = process.env.PREPAID_API_URL;
const PREPAID_API_USER = process.env.PREPAID_API_USER;
const PREPAID_API_PASS = process.env.PREPAID_API_PASS;

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "MAKER" && currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Only Makers can search customers." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { accountNumber } = body;

    if (!accountNumber) {
      return NextResponse.json(
        { error: "Account number is required" },
        { status: 400 },
      );
    }

    // Account Number Validation: must start with 7000 and be exactly 13 digits
    const accountRegex = /^7000\d{9}$/;
    if (!accountRegex.test(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Invalid account number. Must start with 7000 and be 13 digits.",
        },
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
        {
          error:
            "There is already a pending card request for this account number.",
        },
        { status: 400 },
      );
    }

    // Call the external prepaid API
    const response = await fetch(
      `${PREPAID_API_URL}/prepaid/cust-info-by-acct`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${PREPAID_API_USER}:${PREPAID_API_PASS}`).toString("base64")}`,
        },
        body: JSON.stringify({ accountNumber }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        { error: "Failed to fetch customer information" },
        { status: response.status },
      );
    }

    const data = await response.json();

    // Log customer search
    await createAuditLog({
      actorType: "USER",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "VIEW_REQUEST", // Using VIEW_REQUEST as a proxy for searching/viewing customer info
      entityType: "CARD_REQUEST",
      details: { accountNumber, event: "CUSTOMER_SEARCH" },
    });

    return NextResponse.json({
      success: true,
      customer: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to search customer" },
      { status: 500 },
    );
  }
}
