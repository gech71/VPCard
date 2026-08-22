import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import {
  getCardRequestFeeConfig,
  saveCardRequestFeeConfig,
} from "@/lib/card-request-fee";

const feeSchema = z.object({
  paymentRequired: z.boolean(),
  active: z.boolean(),
  amount: z
    .number()
    .nonnegative("Fee cannot be negative")
    .max(1_000_000, "Fee is unrealistically large"),
  currency: z.string().trim().min(1).max(8),
});

async function requireSuperAdmin() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only Super Admin can configure the card request fee" },
        { status: 403 },
      ),
    };
  }

  return { currentUser };
}

export async function GET() {
  try {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    return NextResponse.json({ config: await getCardRequestFeeConfig() });
  } catch {
    return NextResponse.json(
      { error: "Failed to load the card request fee configuration" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { currentUser, error } = await requireSuperAdmin();
    if (error) return error;

    const body = await request.json();
    const validation = feeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { paymentRequired, active, amount, currency } = validation.data;

    // Turning payment on with nothing to charge would silently behave as free,
    // which is exactly the kind of surprise this check exists to prevent.
    if (paymentRequired && active && amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Set a fee greater than zero before requiring payment, or switch Payment Required off.",
        },
        { status: 400 },
      );
    }

    await saveCardRequestFeeConfig({ paymentRequired, active, amount, currency });

    const config = await getCardRequestFeeConfig();

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "UPDATE_CARD_REQUEST_FEE",
      entityType: "SETTINGS",
      details: {
        event: "UPDATE_CARD_REQUEST_FEE",
        paymentRequired,
        active,
        amount,
        currency,
        paymentEnforced: config.paymentEnforced,
      },
    });

    return NextResponse.json({ success: true, config });
  } catch {
    return NextResponse.json(
      { error: "Failed to save the card request fee configuration" },
      { status: 500 },
    );
  }
}
