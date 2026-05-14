import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/jwt-auth";
import {
  getCardProgramsForAudience,
  type CardProgramAudience,
} from "@/lib/card-programs";

export async function GET(request: NextRequest) {
  try {
    const audienceParam = request.nextUrl.searchParams.get("audience");
    if (audienceParam !== "maker" && audienceParam !== "self") {
      return NextResponse.json(
        { error: "Query parameter audience must be maker or self" },
        { status: 400 },
      );
    }
    const audience = audienceParam as CardProgramAudience;

    if (audience === "maker") {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "MAKER") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const programs = await getCardProgramsForAudience(audience);
    return NextResponse.json({ programs });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load card programs" },
      { status: 500 },
    );
  }
}
