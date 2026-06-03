import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import {
  type CurrencyImportRow,
  getValidCurrenciesForImport,
} from "@/lib/currency-import";

const importSchema = z.object({
  rows: z.array(
    z.object({
      rowNumber: z.number(),
      curIde: z.string(),
      curLabel: z.string(),
      curAlphaCode: z.string(),
      status: z.enum(["valid", "invalid", "duplicate"]),
      errors: z.array(z.string()),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = importSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const rows = validation.data.rows as CurrencyImportRow[];
    const toWrite = getValidCurrenciesForImport(rows);

    if (toWrite.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid rows to import. Fix validation errors and try again.",
        },
        { status: 400 },
      );
    }

    let written = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const { curIde, curLabel, curAlphaCode } of toWrite) {
        const existing = await tx.currency.findUnique({
          where: { curIde },
          select: { id: true },
        });

        await tx.currency.upsert({
          where: { curIde },
          create: { curIde, curLabel, curAlphaCode },
          update: { curLabel, curAlphaCode },
        });

        if (existing) updated++;
        else written++;
      }
    });

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "REGISTER_USER",
      entityType: "USER",
      details: {
        event: "CURRENCY_IMPORT",
        rowsCreated: written,
        rowsUpdated: updated,
        totalSubmitted: rows.length,
      },
    });

    const parts: string[] = [];
    if (written > 0) {
      parts.push(`Imported ${written} new currency record(s).`);
    }
    if (updated > 0) {
      parts.push(`Updated ${updated} existing currency record(s).`);
    }

    return NextResponse.json({
      success: true,
      rowsCreated: written,
      rowsUpdated: updated,
      message: parts.join(" "),
    });
  } catch (err) {
    console.error("Currency import failed:", err);
    return NextResponse.json(
      { error: "Failed to save currencies. Please try again." },
      { status: 500 },
    );
  }
}
