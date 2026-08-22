import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { maskPan } from "@/lib/card-encryption";
import { getEcommerceActivationState } from "@/lib/ecommerce-eligibility";

/**
 * Cards visible to the signed-in checker for e-commerce activation.
 *
 * Deliberately separate from /api/card-requests so the approval and activation
 * workflows can evolve independently. Scope matches the approval rule: a checker
 * only ever sees requests assigned to them.
 */
export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "CHECKER") {
      return NextResponse.json(
        { error: "Only Checkers can manage e-commerce activation" },
        { status: 403 },
      );
    }

    const requests = await prisma.cardRequest.findMany({
      where: {
        checkerId: currentUser.userId,
        status: "APPROVED",
      },
      orderBy: [{ ecommerceActivated: "asc" }, { reviewedAt: "desc" }],
      select: {
        id: true,
        customerId: true,
        accountNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        cardProgramCode: true,
        cardProgramName: true,
        status: true,
        pan: true,
        reviewedAt: true,
        createdAt: true,
        ecommerceActivated: true,
        ecommerceActivatedAt: true,
        maker: { select: { email: true } },
      },
    });

    // The stored PAN is encrypted; only ever expose a masked form to the client.
    const cards = requests.map(({ pan, ...rest }) => ({
      ...rest,
      maskedPan: pan ? maskPan(pan) : null,
      activationState: getEcommerceActivationState({
        status: rest.status,
        pan,
        ecommerceActivated: rest.ecommerceActivated,
      }),
    }));

    return NextResponse.json({
      cards,
      summary: {
        total: cards.length,
        eligible: cards.filter((c) => c.activationState === "ELIGIBLE").length,
        activated: cards.filter((c) => c.activationState === "ACTIVATED").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
