import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";

/**
 * One PSS exchange in full, including both payloads.
 *
 * The payloads returned here were redacted before they were stored - see
 * lib/pss-redact.ts - so this endpoint does no masking of its own. That is
 * deliberate: masking at read time would imply the raw values exist somewhere,
 * and they do not.
 */
function idFrom(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1];
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

    const id = idFrom(request);

    const log = await prisma.pssApiLog.findUnique({ where: { id } });

    if (!log) {
      return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
    }

    return NextResponse.json({ log });
  } catch (error) {
    console.error("PSS API log lookup failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
