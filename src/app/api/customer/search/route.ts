import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PREPAID_API_URL =
  process.env.PREPAID_API_URL;
const PREPAID_API_USER = process.env.PREPAID_API_USER;
const PREPAID_API_PASS = process.env.PREPAID_API_PASS;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountNumber } = body;

    if (!accountNumber) {
      return NextResponse.json(
        { error: "Account number is required" },
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
      console.error("Prepaid API error:", response.status, errorText);

      return NextResponse.json(
        { error: "Failed to fetch customer information" },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      customer: data,
    });
  } catch (error) {
    console.error("Customer search error:", error);
    return NextResponse.json(
      { error: "Failed to search customer" },
      { status: 500 },
    );
  }
}
