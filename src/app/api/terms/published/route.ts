import { NextResponse } from "next/server";

import { getPublishedTerms } from "@/lib/terms";

/**
 * The terms currently in force, for the agreement block on the request forms.
 *
 * Served to makers (JWT) and self-service requesters (legacy session) alike -
 * the same shape both use - because the published terms are the document
 * requesters are legally required to be shown, not privileged data. Returns
 * `terms: null` when a Super Admin has not published anything yet.
 */
export async function GET() {
  try {
    const terms = await getPublishedTerms();
    return NextResponse.json({ terms });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load Terms & Conditions" },
      { status: 500 },
    );
  }
}
