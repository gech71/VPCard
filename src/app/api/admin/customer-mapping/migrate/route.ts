import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import {
  type CustomerMappingImportRow,
  getValidRowsForMigration,
} from "@/lib/customer-mapping-import";

const migrateSchema = z.object({
  rows: z.array(
    z.object({
      rowNumber: z.number(),
      nibCusId: z.string(),
      pssCusId: z.string(),
      status: z.enum(["valid", "invalid", "duplicate"]),
      errors: z.array(z.string()),
    }),
  ),
});

function migrateErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(", ")
        : "NIBCusID and PSSCusId";
      return `Duplicate composite mapping: this (${target}) pair already exists in the database.`;
    }
    if (err.code === "P2021") {
      return "Customer mapping table is missing. Run database migrations and try again.";
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Failed to save customer mappings. Please try again or contact support.";
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = migrateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const rows = validation.data.rows as CustomerMappingImportRow[];
    const toWrite = getValidRowsForMigration(rows);

    if (toWrite.length === 0) {
      const hasDuplicates = rows.some((r) => r.status === "duplicate");
      const hasInvalid = rows.some((r) => r.status === "invalid");

      if (hasDuplicates && !hasInvalid) {
        return NextResponse.json(
          {
            error:
              "No rows to migrate: every valid pair in this file is a duplicate within the spreadsheet. Remove duplicate rows and validate again.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error:
            "No valid rows to migrate. Fix validation errors (missing IDs, invalid rows, or in-file duplicates) and try again.",
        },
        { status: 400 },
      );
    }

    const result = await prisma.customerIdMapping.createMany({
      data: toWrite.map(({ nibCusId, pssCusId }) => ({ nibCusId, pssCusId })),
      skipDuplicates: true,
    });

    const written = result.count;
    const skippedExisting = toWrite.length - written;

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "REGISTER_USER",
      entityType: "USER",
      details: {
        event: "CUSTOMER_MAPPING_IMPORT",
        rowsWritten: written,
        rowsSkippedExisting: skippedExisting,
        totalSubmitted: rows.length,
      },
    });

    let message: string;
    if (written === 0 && skippedExisting > 0) {
      message = `No new mappings were added. All ${skippedExisting} composite pair(s) from this file already exist in the database (identical NIBCusID and PSSCusId).`;
    } else if (written > 0 && skippedExisting > 0) {
      message = `Successfully saved ${written} new customer mapping(s). ${skippedExisting} composite pair(s) already existed and were skipped.`;
    } else {
      message = `Successfully saved ${written} new customer mapping(s).`;
    }

    return NextResponse.json({
      success: true,
      rowsWritten: written,
      rowsSkippedExisting: skippedExisting,
      message,
    });
  } catch (err) {
    console.error("Customer mapping migrate failed:", err);
    return NextResponse.json(
      { error: migrateErrorMessage(err) },
      { status: 500 },
    );
  }
}
