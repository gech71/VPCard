import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

/**
 * Card-request fee payment history, for the Super Admin.
 *
 * Returns the filtered rows plus a summary computed over the *whole* filtered
 * set rather than the returned page, so the totals on screen answer "how much
 * did we collect in this period" rather than "how much is on this page".
 *
 * The payment token is deliberately never included: it is a bearer credential
 * for a live transaction, and nothing on an admin screen needs it.
 */

/** Rows returned in one request before the caller is told the list was cut. */
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;

const STATUSES = ["PENDING", "SUCCESS", "FAILED", "CANCELLED"] as const;
type PaymentStatus = (typeof STATUSES)[number];

function isStatus(value: string): value is PaymentStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can view payment history" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const phoneNumber = searchParams.get("phoneNumber");
    // One box that searches every reference a Guest or the bank might quote.
    const reference = searchParams.get("reference");
    const usage = searchParams.get("usage");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const minAmount = parseAmount(searchParams.get("minAmount"));
    const maxAmount = parseAmount(searchParams.get("maxAmount"));

    const where: Prisma.CardRequestPaymentWhereInput = {};

    if (status && status !== "all" && isStatus(status.toUpperCase())) {
      where.status = status.toUpperCase() as PaymentStatus;
    }

    if (phoneNumber) {
      where.phoneNumber = { contains: phoneNumber, mode: "insensitive" };
    }

    if (reference) {
      where.OR = [
        { transactionId: { contains: reference, mode: "insensitive" } },
        { txnRef: { contains: reference, mode: "insensitive" } },
        { paidByNumber: { contains: reference, mode: "insensitive" } },
      ];
    }

    // "Unspent" is the operationally interesting one: money taken from a Guest
    // who never went on to submit a card request with it.
    if (usage === "spent") where.cardRequest = { isNot: null };
    if (usage === "unspent") where.cardRequest = { is: null };

    if (startDate || endDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    if (minAmount != null || maxAmount != null) {
      const amount: Prisma.DecimalFilter = {};
      if (minAmount != null) amount.gte = minAmount;
      if (maxAmount != null) amount.lte = maxAmount;
      where.amount = amount;
    }

    const requestedLimit = Number(searchParams.get("limit"));
    const limit = Math.min(
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    const [rows, total, byStatus, unspent] = await Promise.all([
      prisma.cardRequestPayment.findMany({
        where,
        // Explicit select, so a token or another sensitive column can never be
        // added to the model and start leaking from here by default.
        select: {
          id: true,
          transactionId: true,
          txnRef: true,
          phoneNumber: true,
          amount: true,
          currency: true,
          status: true,
          paidAmount: true,
          paidByNumber: true,
          paidAt: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
          paymentToken: false,
          cardRequest: {
            select: {
              id: true,
              status: true,
              customerName: true,
              accountNumber: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.cardRequestPayment.count({ where }),
      prisma.cardRequestPayment.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.cardRequestPayment.aggregate({
        where: { ...where, status: "SUCCESS", cardRequest: { is: null } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const counts = Object.fromEntries(
      STATUSES.map((s) => [s, 0]),
    ) as Record<PaymentStatus, number>;
    const totals = Object.fromEntries(
      STATUSES.map((s) => [s, 0]),
    ) as Record<PaymentStatus, number>;

    for (const group of byStatus) {
      const key = group.status as PaymentStatus;
      counts[key] = group._count._all;
      totals[key] = Number(group._sum.amount ?? 0);
    }

    return NextResponse.json({
      payments: rows.map((row) => ({
        ...row,
        // Decimal does not survive JSON as a number, and every consumer wants
        // one - format at the edge rather than in five places on the client.
        amount: Number(row.amount),
      })),
      total,
      // Tells the screen its list is a window onto a larger result set, so it
      // can say so instead of quietly showing a subset.
      truncated: total > rows.length,
      summary: {
        counts,
        totals,
        collected: totals.SUCCESS,
        unspentCount: unspent._count._all,
        unspentTotal: Number(unspent._sum.amount ?? 0),
      },
    });
  } catch (error) {
    console.error("[admin-payments] list failed", error);
    return NextResponse.json(
      { error: "Failed to load payment history" },
      { status: 500 },
    );
  }
}
