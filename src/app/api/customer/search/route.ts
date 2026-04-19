import { NextRequest, NextResponse } from "next/server";

const PREPAID_API_URL =
  process.env.PREPAID_API_URL || "http://192.168.100.56:8280";
const PREPAID_API_USER = process.env.PREPAID_API_USER || "test";
const PREPAID_API_PASS = process.env.PREPAID_API_PASS || "123456";

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
