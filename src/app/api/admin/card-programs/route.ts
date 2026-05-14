import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  programs: z.array(
    z.object({
      code: z.string(),
      enabledForMaker: z.boolean(),
      enabledForSelf: z.boolean(),
    }),
  ),
});

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(32)
    .regex(/^\d+$/, "Program code must be digits only"),
  name: z.string().trim().min(1, "Name is required").max(200),
  bin: z
    .string()
    .trim()
    .min(1, "BIN is required")
    .max(32)
    .regex(/^\d+$/, "BIN must be digits only"),
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { code, name, bin } = validation.data;

    const existing = await prisma.cardProgram.findUnique({
      where: { code },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A card program with this code already exists." },
        { status: 409 },
      );
    }

    await prisma.cardProgram.create({
      data: {
        code,
        name,
        bin,
        enabledForMaker: true,
        enabledForSelf: true,
      },
    });

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "REGISTER_USER",
      entityType: "USER",
      details: {
        event: "CREATE_CARD_PROGRAM",
        code,
        name,
        bin,
      },
    });

    const cardPrograms = await prisma.cardProgram.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, cardPrograms }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create card program" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { programs } = validation.data;

    for (const row of programs) {
      const existing = await prisma.cardProgram.findUnique({
        where: { code: row.code },
      });
      if (!existing) continue;
      await prisma.cardProgram.update({
        where: { code: row.code },
        data: {
          enabledForMaker: row.enabledForMaker,
          enabledForSelf: row.enabledForSelf,
        },
      });
    }

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "REGISTER_USER",
      entityType: "USER",
      details: {
        event: "UPDATE_CARD_PROGRAMS",
        count: programs.length,
      },
    });

    const updated = await prisma.cardProgram.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, cardPrograms: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update card programs" },
      { status: 500 },
    );
  }
}
