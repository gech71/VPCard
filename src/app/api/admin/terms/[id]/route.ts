import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { validateTermsDoc } from "@/lib/terms";

const updateTermsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  content: z.object({
    type: z.literal("doc"),
    content: z.array(z.any()).optional(),
  }),
});

function idFrom(request: NextRequest, offsetFromEnd = 0) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1 - offsetFromEnd];
}

/** Edits a draft. Published and archived versions are immutable on purpose. */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can manage Terms & Conditions" },
        { status: 403 },
      );
    }

    const id = idFrom(request);
    const body = await request.json();
    const validation = updateTermsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const existing = await prisma.termsVersion.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // A published version is what people have already agreed to. Editing it in
    // place would silently rewrite the wording behind every recorded
    // acceptance, so changes go into a new draft instead.
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          error:
            "Published and archived versions cannot be edited. Duplicate this version to a new draft instead.",
        },
        { status: 409 },
      );
    }

    const { title, content } = validation.data;

    // Second gate: the outer shape is valid JSON, but every node and mark must
    // also be one the read-only renderer can display.
    const docCheck = validateTermsDoc(content);

    if (!docCheck.ok) {
      return NextResponse.json({ error: docCheck.error }, { status: 400 });
    }

    const updated = await prisma.termsVersion.update({
      where: { id },
      data: { title, content },
    });

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "UPDATE_TERMS",
      entityType: "TERMS",
      entityId: id,
      details: { event: "UPDATE_TERMS", title },
    });

    return NextResponse.json({ success: true, terms: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 },
    );
  }
}

/** Discards a draft. Only drafts can be removed. */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can manage Terms & Conditions" },
        { status: 403 },
      );
    }

    const id = idFrom(request);
    const existing = await prisma.termsVersion.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          error:
            "Only drafts can be deleted. Published and archived versions are kept as the record of what requesters agreed to.",
        },
        { status: 409 },
      );
    }

    await prisma.termsVersion.delete({ where: { id } });

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "DELETE_TERMS",
      entityType: "TERMS",
      entityId: id,
      details: { event: "DELETE_TERMS", title: existing.title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 },
    );
  }
}
