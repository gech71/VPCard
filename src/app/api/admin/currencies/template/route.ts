import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/jwt-auth";
import { buildCurrencyTemplateBuffer } from "@/lib/currency-import";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buffer = buildCurrencyTemplateBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="currency-template.xlsx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate template." },
      { status: 500 },
    );
  }
}
