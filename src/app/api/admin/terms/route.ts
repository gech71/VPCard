import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getCurrentUser, type JWTPayload } from "@/lib/jwt-auth";
import { createAuditLog } from "@/lib/audit";
import { validateTermsDoc } from "@/lib/terms";

/**
 * The editor round-trips a ProseMirror document. Zod checks the outer shape
 * only; validateTermsDoc() then walks it against the node and mark allowlist,
 * because this endpoint is reachable directly and not just through the editor.
 */
const proseMirrorDoc = z.object({
  type: z.literal("doc"),
  content: z.array(z.any()).optional(),
});

const createTermsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  content: proseMirrorDoc,
});

type Guard =
  | { currentUser: JWTPayload; error?: undefined }
  | { currentUser?: undefined; error: NextResponse };

async function requireSuperAdmin(): Promise<Guard> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only Super Admin can manage Terms & Conditions" },
        { status: 403 },
      ),
    };
  }

  return { currentUser };
}

/** Every version, newest first, plus whichever one is currently in force. */
export async function GET() {
  try {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const versions = await prisma.termsVersion.findMany({
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        version: true,
        title: true,
        content: true,
        status: true,
        createdBy: true,
        publishedBy: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { acceptances: true } },
      },
    });

    const published = versions.find((v) => v.status === "PUBLISHED") ?? null;

    return NextResponse.json({ versions, published });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load Terms & Conditions" },
      { status: 500 },
    );
  }
}

/** Creates a new draft. Drafts are the only editable state. */
export async function POST(request: NextRequest) {
  try {
    const { currentUser, error } = await requireSuperAdmin();
    if (error) return error;

    const body = await request.json();
    const validation = createTermsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { title, content } = validation.data;

    // Second gate: the outer shape is valid JSON, but every node and mark must
    // also be one the read-only renderer can display.
    const docCheck = validateTermsDoc(content);

    if (!docCheck.ok) {
      return NextResponse.json({ error: docCheck.error }, { status: 400 });
    }

    const draft = await prisma.termsVersion.create({
      data: {
        title,
        content,
        status: "DRAFT",
        createdBy: currentUser.userId,
      },
    });

    await createAuditLog({
      actorType: "ADMIN",
      actorId: currentUser.userId,
      actorEmail: currentUser.email,
      action: "CREATE_TERMS",
      entityType: "TERMS",
      entityId: draft.id,
      details: { event: "CREATE_TERMS", title },
    });

    return NextResponse.json({ success: true, terms: draft });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create draft" },
      { status: 500 },
    );
  }
}
