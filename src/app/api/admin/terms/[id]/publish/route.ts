import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";

/**
 * Puts a draft into force. Exactly one version is PUBLISHED at a time: the
 * outgoing one is archived and the incoming one takes the next version number,
 * both inside a single transaction so requesters can never see two sets of
 * terms or none at all.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can publish Terms & Conditions" },
        { status: 403 },
      );
    }

    const parts = request.nextUrl.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 2]; // .../terms/[id]/publish

    const draft = await prisma.termsVersion.findUnique({ where: { id } });

    if (!draft) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (draft.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "This version is already published" },
        { status: 409 },
      );
    }

    if (draft.status !== "DRAFT") {
      return NextResponse.json(
        {
          error:
            "Only drafts can be published. Duplicate this version to a new draft first.",
        },
        { status: 409 },
      );
    }

    const highest = await prisma.termsVersion.findFirst({
      where: { version: { not: null } },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (highest?.version ?? 0) + 1;
    const publishedAt = new Date();

    const [, published] = await prisma.$transaction([
      prisma.termsVersion.updateMany({
        where: { status: "PUBLISHED" },
        data: { status: "ARCHIVED" },
      }),
      prisma.termsVersion.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          version: nextVersion,
          publishedAt,
          publishedBy: currentUser.userId,
        },
      }),
    ]);

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "PUBLISH_TERMS",
      entityType: "TERMS",
      entityId: id,
      details: {
        event: "PUBLISH_TERMS",
        title: published.title,
        version: nextVersion,
      },
    });

    return NextResponse.json({ success: true, terms: published });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to publish" },
      { status: 500 },
    );
  }
}
