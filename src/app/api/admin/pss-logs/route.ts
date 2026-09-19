import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

/**
 * PSS API request/response history, for the Super Admin.
 *
 * The list deliberately omits the payloads. They are the bulk of a row and are
 * useless in a table; the detail endpoint serves them one record at a time when
 * someone actually opens an exchange. That keeps this response small enough to
 * page through thousands of calls without shipping megabytes of JSON.
 *
 * Authorisation is enforced here, independently of the /admin layout guard and
 * of whether the menu item is visible. The layout stops a browser reaching the
 * page; only this check stops anything reaching the data.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const SORTABLE = ["createdAt", "durationMs", "statusCode", "serviceName"] as const;
type SortField = (typeof SORTABLE)[number];

function isSortable(value: string | null): value is SortField {
  return !!value && (SORTABLE as readonly string[]).includes(value);
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can view PSS API logs" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const service = searchParams.get("service");
    const outcome = searchParams.get("outcome"); // success | failure
    const method = searchParams.get("method");
    const startDate = parseDate(searchParams.get("startDate"));
    const endDate = parseDate(searchParams.get("endDate"));

    const sortParam = searchParams.get("sortBy");
    const sortBy: SortField = isSortable(sortParam) ? sortParam : "createdAt";
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    const where: Prisma.PssApiLogWhereInput = {};

    if (service && service !== "all") {
      where.serviceName = service;
    }

    if (method && method !== "all") {
      where.method = method.toUpperCase();
    }

    if (outcome === "success") where.success = true;
    if (outcome === "failure") where.success = false;

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        // An end date with no time means "to the end of that day", which is
        // what someone picking a date on a filter expects.
        ...(endDate
          ? { lte: /T/.test(searchParams.get("endDate") ?? "")
              ? endDate
              : new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1) }
          : {}),
      };
    }

    // One box across every field an engineer would have to hand: the endpoint
    // from a spec, a correlation id from the bank, or a fragment of the error.
    if (search) {
      where.OR = [
        { endpoint: { contains: search, mode: "insensitive" } },
        { serviceName: { contains: search, mode: "insensitive" } },
        { correlationId: { contains: search, mode: "insensitive" } },
        { errorMessage: { contains: search, mode: "insensitive" } },
      ];
    }

    const [logs, total, failures, services, aggregate] = await Promise.all([
      prisma.pssApiLog.findMany({
        where,
        // Payloads excluded on purpose - see the note at the top of this file.
        select: {
          id: true,
          createdAt: true,
          serviceName: true,
          endpoint: true,
          method: true,
          environment: true,
          statusCode: true,
          success: true,
          durationMs: true,
          correlationId: true,
          errorMessage: true,
        },
        orderBy: { [sortBy]: sortDir },
        take: limit,
        skip: offset,
      }),
      prisma.pssApiLog.count({ where }),
      prisma.pssApiLog.count({ where: { ...where, success: false } }),
      // Drives the service filter, over the whole table rather than the current
      // page, so a service with no matches this week is still selectable.
      prisma.pssApiLog.findMany({
        distinct: ["serviceName"],
        select: { serviceName: true },
        orderBy: { serviceName: "asc" },
      }),
      // Averaged over the filtered set, not the page, so the number answers
      // "how is this service behaving" rather than "how were these 50 calls".
      prisma.pssApiLog.aggregate({ where, _avg: { durationMs: true } }),
    ]);

    return NextResponse.json({
      logs,
      total,
      summary: {
        total,
        failures,
        successes: total - failures,
        avgDurationMs: Math.round(aggregate._avg.durationMs ?? 0),
      },
      services: services.map((s) => s.serviceName),
    });
  } catch (error) {
    console.error("PSS API log query failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
