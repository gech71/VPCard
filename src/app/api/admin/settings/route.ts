import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { z } from "zod";

const settingsSchema = z.object({
  allowSelfCardRequest: z.boolean(),
  defaultCheckerId: z.string().uuid("Invalid checker ID"),
});

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all settings
    const settingsRecords = await prisma.settings.findMany();
    const settings: Record<string, string> = {};

    for (const record of settingsRecords) {
      settings[record.key] = record.value;
    }

    // Get all checkers for the dropdown
    const checkers = await prisma.user.findMany({
      where: { role: "CHECKER" },
      select: { id: true, email: true },
    });

    return NextResponse.json({
      settings,
      checkers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { allowSelfCardRequest, defaultCheckerId } = validation.data;

    // Verify checker exists and has CHECKER role
    const checker = await prisma.user.findFirst({
      where: { id: defaultCheckerId, role: "CHECKER" },
    });

    if (!checker) {
      return NextResponse.json(
        { error: "Invalid checker selected" },
        { status: 400 },
      );
    }

    // Upsert settings
    await prisma.settings.upsert({
      where: { key: "allowSelfCardRequest" },
      update: { value: allowSelfCardRequest.toString() },
      create: {
        key: "allowSelfCardRequest",
        value: allowSelfCardRequest.toString(),
      },
    });

    await prisma.settings.upsert({
      where: { key: "defaultCheckerId" },
      update: { value: defaultCheckerId },
      create: { key: "defaultCheckerId", value: defaultCheckerId },
    });

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
